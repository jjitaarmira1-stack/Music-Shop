import "server-only"; // Impide que este módulo se empaquete en el navegador.
import { z } from "zod"; // Validador de esquemas.

// ═══════════════════════════════════════════════════════════════
//  CONFIGURACIÓN CENTRAL DEL ENTORNO
//  Único punto donde se leen las variables de entorno. Se validan
//  al arrancar para que un fallo de configuración se detecte YA,
//  y no a mitad de una petición de un cliente real.
// ═══════════════════════════════════════════════════════════════

/** Longitud mínima aceptable para la clave de firma de sesiones. */
const LONGITUD_MINIMA_SECRETO = 32;

/**
 * Indica si estamos ejecutando la compilación de producción.
 * `NODE_ENV` lo fija Next automáticamente ("development" | "production" | "test").
 */
const esProduccion = process.env.NODE_ENV === "production";

/**
 * Esquema de validación de todas las variables de entorno del servidor.
 * Cada campo lleva su regla y su mensaje de error en español.
 */
/**
 * Limpia un valor copiado a mano desde el panel de un proveedor.
 *
 * Es sorprendentemente fácil que se cuelen caracteres de más al pegar
 * una cadena de conexión, y el error que provocan no menciona la causa
 * («debe empezar por postgres://» cuando a simple vista sí empieza).
 * Se corrigen aquí en lugar de hacer perder media hora a nadie:
 *
 *   · espacios y saltos de línea al principio o al final,
 *   · comillas simples o dobles envolviendo el valor,
 *   · un punto y coma final (típico al copiar de un ejemplo SQL).
 *
 * Lo que NO se toca: el contenido real de la cadena. Si está mal
 * escrita de verdad, se sigue rechazando.
 */
function limpiarValor(valor: unknown): unknown {
  if (typeof valor !== "string") return valor;

  let limpio = valor.trim(); // Espacios y saltos de línea.

  // Comillas envolviendo todo el valor: "postgresql://..." o '...'
  const entrecomillado =
    (limpio.startsWith('"') && limpio.endsWith('"')) ||
    (limpio.startsWith("'") && limpio.endsWith("'"));
  if (entrecomillado && limpio.length >= 2) {
    limpio = limpio.slice(1, -1).trim();
  }

  // Punto y coma final.
  if (limpio.endsWith(";")) limpio = limpio.slice(0, -1).trim();

  return limpio;
}

const esquemaEntorno = z.object({
  // ─── Conexión a la base de datos (obligatoria siempre) ───────
  // Se limpia ANTES de validar (`preprocess`): así una cadena correcta
  // pegada con comillas o con un espacio delante funciona, en lugar de
  // tumbar el despliegue con un mensaje que no señala la causa real.
  DATABASE_URL: z.preprocess(
    limpiarValor,
    z
      .string({ message: "DATABASE_URL es obligatoria" })
      .min(1, "DATABASE_URL no puede estar vacía")
      // Aceptamos los dos prefijos habituales de PostgreSQL.
      .refine(
        (valor) =>
          valor.startsWith("postgres://") || valor.startsWith("postgresql://"),
        "DATABASE_URL debe empezar por postgres:// o postgresql://",
      ),
  ),

  // ─── Clave de firma de sesiones ──────────────────────────────
  // En producción es OBLIGATORIA y con longitud mínima: nunca se
  // permite un valor por defecto escrito en el código fuente.
  SESSION_SECRET: z.preprocess(
    limpiarValor,
    z
      .string()
      .min(
        LONGITUD_MINIMA_SECRETO,
        `SESSION_SECRET debe tener al menos ${LONGITUD_MINIMA_SECRETO} caracteres`,
      )
      // En desarrollo permitimos omitirla para no estorbar al programar.
      .optional(),
  ),

  // ─── Entorno lógico de la aplicación ─────────────────────────
  // Permite distinguir "staging" de "production", cosa que NODE_ENV no hace.
  APP_ENV: z
    .enum(["development", "staging", "production"])
    .default(esProduccion ? "production" : "development"),

  // ─── Carpeta donde se guardan las imágenes subidas ───────────
  // Vacío = se usa el valor por defecto calculado más abajo.
  UPLOADS_DIR: z.string().optional(),

  // ─── Semilla de datos de demostración ────────────────────────
  // Llega como texto ("true"/"false"); lo convertimos a booleano.
  SEED_DEMO_DATA: z
    .string()
    .optional()
    .transform((valor) => valor !== "false"), // por defecto true

  // ─── Credenciales iniciales del administrador (opcionales) ───
  ADMIN_EMAIL: z
    .string()
    .email("ADMIN_EMAIL debe ser un correo válido")
    .optional()
    .or(z.literal("")), // toleramos la cadena vacía de la plantilla
  ADMIN_PASSWORD: z.string().optional(),

  // ─── Tamaño del pool de conexiones ───────────────────────────
  // Estaba documentada en .env.example pero no se leía: ajustarla no
  // tenía ningún efecto. Ahora sí se aplica.
  DB_POOL_MAX: z.coerce.number().int().positive().max(100).optional(),

  // ─── Parámetros del limitador de peticiones ──────────────────
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_LOGIN_WINDOW: z.coerce.number().int().positive().default(900),
});

/**
 * ¿Estamos DENTRO de la compilación (`next build`)?
 *
 * Next marca esta fase con `NEXT_PHASE`. Durante la compilación, Next
 * importa cada ruta para analizarla, y al importarlas se ejecuta este
 * archivo. Eso tiene una consecuencia importante:
 *
 *   COMPILAR NO REQUIERE BASE DE DATOS. Son dos momentos distintos:
 *   se compila en el servidor de Netlify/Vercel, y se ejecuta después
 *   con las variables de entorno de producción ya puestas.
 *
 * Antes este archivo lanzaba un error al importarse, así que la
 * compilación fallaba con «DATABASE_URL es obligatoria» aunque la
 * variable estuviera perfectamente configurada para la ejecución.
 * Por eso aquí distinguimos las dos fases.
 */
const esFaseDeCompilacion =
  process.env.NEXT_PHASE === "phase-production-build";

/**
 * Valores de relleno que se usan SÓLO mientras se compila.
 * Nunca llegan a producción: en cuanto la aplicación se ejecuta de
 * verdad, la validación vuelve a ser estricta y aborta si falta algo.
 */
const RELLENO_COMPILACION = {
  DATABASE_URL: "postgresql://compilacion:compilacion@127.0.0.1:5432/compilacion",
  SESSION_SECRET: "x".repeat(LONGITUD_MINIMA_SECRETO),
} as const;

/**
 * Ejecuta la validación sobre `process.env`.
 * Si algo falla, lanzamos un error con TODOS los problemas juntos,
 * para no obligar al programador a arreglarlos de uno en uno.
 */
function cargarEntorno() {
  const resultado = esquemaEntorno.safeParse(process.env);

  // Si la validación falla, abortamos el arranque con un mensaje claro.
  if (!resultado.success) {
    const problemas = resultado.error.issues
      .map((incidencia) => `  • ${incidencia.path.join(".")}: ${incidencia.message}`)
      .join("\n");

    // ─── Durante la compilación: avisar, pero NO abortar ─────────
    // Se deja constancia bien visible en el registro del despliegue
    // y se sigue adelante con valores de relleno. Si la variable
    // tampoco existe al ejecutarse, la aplicación fallará entonces
    // con este mismo mensaje, que es el momento correcto para hacerlo.
    if (esFaseDeCompilacion) {
      console.warn(
        "\n[entorno] AVISO DURANTE LA COMPILACIÓN\n" +
          `${problemas}\n` +
          "La compilación continúa con valores de relleno, porque compilar\n" +
          "no necesita base de datos. PERO la aplicación NO ARRANCARÁ si\n" +
          "estas variables no están configuradas en tu proveedor de\n" +
          "alojamiento (Netlify: Site settings → Environment variables).\n",
      );

      // ─── Segundo intento con valores de relleno ────────────────
      // OJO con un detalle que ya falló una vez: no basta con
      // sustituir lo que FALTA (`valor || relleno`). Si la variable
      // existe pero es INVÁLIDA —por ejemplo una DATABASE_URL copiada
      // con comillas—, `||` la conserva, la validación vuelve a
      // fallar y la compilación se cae igualmente.
      //
      // Aquí se descarta cualquier valor que no pase la validación,
      // sea porque falta o porque está mal escrito.
      const entradaSegura: Record<string, unknown> = { ...process.env };

      for (const incidencia of resultado.error.issues) {
        const campo = String(incidencia.path[0]);
        // Si tenemos relleno para ese campo, se usa.
        if (campo in RELLENO_COMPILACION) {
          entradaSegura[campo] =
            RELLENO_COMPILACION[campo as keyof typeof RELLENO_COMPILACION];
        } else {
          // Sin relleno definido: se quita para que actúe el valor
          // por defecto del esquema, si lo tiene.
          delete entradaSegura[campo];
        }
      }

      const segundoIntento = esquemaEntorno.safeParse(entradaSegura);

      // Si aun así falla, la compilación NO debe caerse: se avisa y se
      // devuelve la configuración mínima viable. Compilar nunca puede
      // depender de que las variables de producción sean correctas.
      if (!segundoIntento.success) {
        console.warn(
          "[entorno] No se pudo normalizar el entorno de compilación. " +
            "Se continúa con la configuración mínima.",
        );
        return esquemaEntorno.parse({ ...RELLENO_COMPILACION });
      }

      return segundoIntento.data;
    }

    // ─── En ejecución real: sí abortamos ─────────────────────────
    throw new Error(
      `Configuración de entorno inválida:\n${problemas}\n` +
        `Revisa tu archivo .env (usa .env.example como guía).\n` +
        `Si estás en Netlify o Vercel, defínelas en el panel del sitio, ` +
        `en «Environment variables», y vuelve a desplegar.`,
    );
  }

  const datos = resultado.data;

  // ─── Regla adicional: en producción el secreto es obligatorio ──
  // Este es el fallo crítico C-2 del informe: antes existía un valor
  // por defecto en el código, y eso permitía falsificar sesiones.
  // Durante la compilación no se aplica, por lo explicado arriba.
  if (esProduccion && !esFaseDeCompilacion && !datos.SESSION_SECRET) {
    throw new Error(
      "SESSION_SECRET es obligatoria en producción. " +
        "Genera una con: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"",
    );
  }

  return datos;
}

/** Variables ya validadas (se evalúa una sola vez al importar el módulo). */
const entorno = cargarEntorno();

/**
 * Secreto de sesión definitivo.
 * En producción siempre viene del entorno (validado arriba).
 * En desarrollo, si falta, generamos uno EFÍMERO en memoria: distinto en
 * cada arranque, así nunca hay una clave conocida escrita en el repositorio.
 * Efecto secundario aceptado: al reiniciar el servidor de desarrollo se
 * cierran las sesiones abiertas.
 */
const secretoSesion: string =
  entorno.SESSION_SECRET ??
  (() => {
    // Import síncrono local para no cargar 'crypto' si no hace falta.
    const { randomBytes } = require("node:crypto") as typeof import("node:crypto");
    const efimero = randomBytes(48).toString("base64url");
    console.warn(
      "[entorno] SESSION_SECRET no definida: usando una clave EFÍMERA de desarrollo. " +
        "Las sesiones se cerrarán al reiniciar el servidor.",
    );
    return efimero;
  })();

/**
 * Objeto de configuración que consume el resto de la aplicación.
 * Exponer un objeto ya procesado (en vez de `process.env` suelto) evita
 * errores de tecleo y centraliza los valores por defecto.
 */
/**
 * ¿Estamos en un alojamiento SIN disco permanente?
 *
 * Netlify y Vercel definen estas variables automáticamente. En esas
 * plataformas el sistema de archivos es efímero: lo que se escribe
 * desaparece, y la carpeta del proyecto es de sólo lectura.
 *
 * Saberlo permite dos cosas: escribir en /tmp en vez de fallar con un
 * error de permisos, y avisar de que las imágenes subidas no van a
 * conservarse.
 */
const esAlojamientoEfimero = Boolean(
  process.env.NETLIFY || process.env.VERCEL,
);

export const CONFIG = {
  /** Cadena de conexión a PostgreSQL. */
  urlBaseDatos: entorno.DATABASE_URL,

  /** `true` en Netlify, Vercel y similares (disco efímero). */
  esAlojamientoEfimero,

  /**
   * Conexiones máximas del pool.
   *
   * El valor por defecto depende del alojamiento:
   *  · Servidor normal (VPS, Railway): 10. Un único proceso atiende
   *    todas las peticiones y le conviene reutilizar conexiones.
   *  · Netlify/Vercel: 3. Aquí cada petición puede caer en una
   *    instancia distinta, y todas abren su propio pool. Con 10 por
   *    instancia se agotan las conexiones de la base de datos en
   *    cuanto hay algo de tráfico. Además Neon ya agrupa conexiones
   *    por su cuenta si se usa la cadena «-pooler», así que poner
   *    otro pool grande encima es contraproducente.
   */
  maxConexionesPool:
    entorno.DB_POOL_MAX ?? (esAlojamientoEfimero ? 3 : 10),

  /** Clave con la que se firman las cookies de sesión. */
  secretoSesion,

  /** Entorno lógico: development | staging | production. */
  entornoApp: entorno.APP_ENV,

  /** `true` sólo en la compilación de producción real. */
  esProduccion,

  /** `true` cuando conviene mostrar detalles técnicos de los errores. */
  esDesarrollo: !esProduccion,

  /** Carpeta en disco para las imágenes subidas (fuera de `public/`). */
  directorioSubidas: entorno.UPLOADS_DIR || undefined,

  /** Si se debe sembrar el catálogo y las cuentas de demostración. */
  sembrarDatosDemo: entorno.SEED_DEMO_DATA,

  /** Correo del administrador inicial (opcional). */
  correoAdmin: entorno.ADMIN_EMAIL || undefined,

  /** Contraseña del administrador inicial (opcional). */
  contrasenaAdmin: entorno.ADMIN_PASSWORD || undefined,

  /** Configuración del limitador de intentos de inicio de sesión. */
  limitePeticiones: {
    /** Número máximo de intentos permitidos por ventana. */
    maxIntentosLogin: entorno.RATE_LIMIT_LOGIN_MAX,
    /** Duración de la ventana, en segundos. */
    ventanaLoginSegundos: entorno.RATE_LIMIT_LOGIN_WINDOW,
  },
} as const;
