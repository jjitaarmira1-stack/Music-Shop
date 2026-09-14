import "server-only"; // Nunca debe llegar al navegador.
import { CONFIG } from "@/lib/env"; // Para distinguir desarrollo de producción.

// ═══════════════════════════════════════════════════════════════
//  REGISTRO (LOGGING) ESTRUCTURADO
//  Reglas que cumple este módulo:
//   1. En producción escribe JSON en una línea (lo entienden
//      Datadog, CloudWatch, Grafana Loki… sin configurar nada).
//   2. En desarrollo escribe texto legible y coloreado.
//   3. NUNCA registra contraseñas, tokens, cookies ni claves:
//      los valores sensibles se sustituyen automáticamente.
// ═══════════════════════════════════════════════════════════════

/** Niveles de gravedad admitidos, de menor a mayor. */
type NivelRegistro = "debug" | "info" | "warn" | "error";

/** Peso numérico de cada nivel, para poder filtrar por umbral. */
const PESO_NIVEL: Record<NivelRegistro, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Umbral mínimo que se escribe.
 * En producción ocultamos "debug" para no llenar el disco de ruido.
 */
const UMBRAL = CONFIG.esProduccion ? PESO_NIVEL.info : PESO_NIVEL.debug;

/**
 * Nombres de campo cuyo valor JAMÁS debe aparecer en un registro.
 * La comparación es en minúsculas y por "contiene", para cazar
 * variantes como `passwordHash`, `SESSION_SECRET` o `authToken`.
 */
const CLAVES_SENSIBLES = [
  "password", // contraseñas en claro
  "contrasena", // idem en español
  "passwordhash", // hash de contraseña
  "secret", // secretos de firma
  "secreto",
  "token", // tokens de sesión o de API
  "authorization", // cabecera de autenticación
  "cookie", // cookies completas
  "apikey", // claves de API
  "connectionstring", // cadenas de conexión con credenciales
  "database_url", // nuestra propia URL de base de datos
];

/** Texto con el que se reemplaza cualquier valor sensible. */
const CENSURADO = "[oculto]";

/**
 * Recorre un objeto y sustituye los valores de las claves sensibles.
 * Es recursivo para cubrir objetos anidados.
 *
 * @param valor       Dato a limpiar (de cualquier tipo).
 * @param profundidad Control para no caer en bucles infinitos.
 */
function sanear(valor: unknown, profundidad = 0): unknown {
  // Cortamos a partir de cierta profundidad por seguridad.
  if (profundidad > 4) return "[demasiado profundo]";

  // Los tipos simples se devuelven tal cual.
  if (valor === null || typeof valor !== "object") return valor;

  // Los arrays se procesan elemento a elemento.
  if (Array.isArray(valor)) {
    return valor.slice(0, 20).map((elemento) => sanear(elemento, profundidad + 1));
  }

  // Los objetos se recorren clave por clave.
  const resultado: Record<string, unknown> = {};
  for (const [clave, contenido] of Object.entries(valor)) {
    const claveNormalizada = clave.toLowerCase(); // comparación insensible
    // Si el nombre de la clave sugiere un secreto, lo censuramos.
    const esSensible = CLAVES_SENSIBLES.some((patron) =>
      claveNormalizada.includes(patron),
    );
    resultado[clave] = esSensible ? CENSURADO : sanear(contenido, profundidad + 1);
  }
  return resultado;
}

/**
 * Extrae información útil de un error sin filtrar datos internos.
 * La traza de pila sólo se incluye fuera de producción.
 */
function describirError(error: unknown) {
  if (error instanceof Error) {
    return {
      nombre: error.name, // Tipo de error.
      mensaje: error.message, // Mensaje original.
      // La pila revela rutas del servidor: fuera en producción.
      ...(CONFIG.esProduccion ? {} : { pila: error.stack }),
    };
  }
  // Si no es un Error, lo convertimos a texto de forma segura.
  return { mensaje: String(error) };
}

/**
 * Función interna que da formato y escribe la línea de registro.
 *
 * @param nivel    Gravedad del mensaje.
 * @param contexto Módulo o endpoint que lo emite ("auth/login").
 * @param mensaje  Descripción legible.
 * @param error    Error asociado, si lo hay.
 * @param extra    Datos adicionales (se sanean antes de escribir).
 */
function escribir(
  nivel: NivelRegistro,
  contexto: string,
  mensaje: string,
  error?: unknown,
  extra?: Record<string, unknown>,
) {
  // Filtro por umbral: si el nivel es bajo, no escribimos nada.
  if (PESO_NIVEL[nivel] < UMBRAL) return;

  // Estructura común a los dos formatos de salida.
  const entrada = {
    marca: new Date().toISOString(), // Momento exacto (UTC, ordenable).
    nivel, // Gravedad.
    contexto, // De dónde viene.
    mensaje, // Qué ha pasado.
    entorno: CONFIG.entornoApp, // development | staging | production
    ...(extra ? { datos: sanear(extra) } : {}), // Extras ya saneados.
    ...(error ? { error: describirError(error) } : {}), // Error, si lo hay.
  };

  // En producción: una línea JSON, ideal para agregadores de logs.
  if (CONFIG.esProduccion) {
    // Elegimos el flujo correcto: error/warn a stderr, el resto a stdout.
    const salida = nivel === "error" || nivel === "warn" ? console.error : console.log;
    salida(JSON.stringify(entrada));
    return;
  }

  // En desarrollo: formato corto y legible para la terminal.
  const etiqueta = `[${nivel.toUpperCase()}] ${contexto}`;
  const salida = nivel === "error" ? console.error : nivel === "warn" ? console.warn : console.log;
  salida(etiqueta, mensaje, extra ? sanear(extra) : "", error ?? "");
}

/**
 * Registro público de la aplicación.
 * Uso: `registro.info("orders", "pedido creado", undefined, { codigo })`.
 */
export const registro = {
  /** Detalle fino, sólo visible en desarrollo. */
  debug: (contexto: string, mensaje: string, extra?: Record<string, unknown>) =>
    escribir("debug", contexto, mensaje, undefined, extra),

  /** Sucesos normales que conviene poder auditar. */
  info: (contexto: string, mensaje: string, extra?: Record<string, unknown>) =>
    escribir("info", contexto, mensaje, undefined, extra),

  /** Situaciones anómalas que no rompen la petición. */
  warn: (contexto: string, mensaje: string, extra?: Record<string, unknown>) =>
    escribir("warn", contexto, mensaje, undefined, extra),

  /** Fallos que impiden completar la operación. */
  error: (
    contexto: string,
    mensaje: string,
    error?: unknown,
    extra?: Record<string, unknown>,
  ) => escribir("error", contexto, mensaje, error, extra),

  /**
   * Registro específico de seguridad.
   * Se emite siempre a nivel "warn" para que destaque en las alertas:
   * inicios de sesión fallidos, accesos denegados, límites superados…
   */
  seguridad: (
    contexto: string,
    mensaje: string,
    extra?: Record<string, unknown>,
  ) => escribir("warn", contexto, `[SEGURIDAD] ${mensaje}`, undefined, extra),
};
