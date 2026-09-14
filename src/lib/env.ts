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
const esquemaEntorno = z.object({
  // ─── Conexión a la base de datos (obligatoria siempre) ───────
  DATABASE_URL: z
    .string({ message: "DATABASE_URL es obligatoria" })
    .min(1, "DATABASE_URL no puede estar vacía")
    // Aceptamos los dos prefijos habituales de PostgreSQL.
    .refine(
      (valor) =>
        valor.startsWith("postgres://") || valor.startsWith("postgresql://"),
      "DATABASE_URL debe empezar por postgres:// o postgresql://",
    ),

  // ─── Clave de firma de sesiones ──────────────────────────────
  // En producción es OBLIGATORIA y con longitud mínima: nunca se
  // permite un valor por defecto escrito en el código fuente.
  SESSION_SECRET: z
    .string()
    .min(
      LONGITUD_MINIMA_SECRETO,
      `SESSION_SECRET debe tener al menos ${LONGITUD_MINIMA_SECRETO} caracteres`,
    )
    // En desarrollo permitimos omitirla para no estorbar al programar.
    .optional(),

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

  // ─── Parámetros del limitador de peticiones ──────────────────
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_LOGIN_WINDOW: z.coerce.number().int().positive().default(900),
});

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
    throw new Error(
      `Configuración de entorno inválida:\n${problemas}\n` +
        `Revisa tu archivo .env (usa .env.example como guía).`,
    );
  }

  const datos = resultado.data;

  // ─── Regla adicional: en producción el secreto es obligatorio ──
  // Este es el fallo crítico C-2 del informe: antes existía un valor
  // por defecto en el código, y eso permitía falsificar sesiones.
  if (esProduccion && !datos.SESSION_SECRET) {
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
export const CONFIG = {
  /** Cadena de conexión a PostgreSQL. */
  urlBaseDatos: entorno.DATABASE_URL,

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
