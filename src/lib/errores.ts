import "server-only"; // Este módulo nunca debe acabar en el navegador.
import { NextResponse } from "next/server"; // Utilidad de respuesta de Next.
import { randomUUID } from "node:crypto"; // Para el identificador de incidencia.
import { ZodError } from "zod"; // Para reconocer errores de validación.
import { CONFIG } from "@/lib/env"; // Saber si estamos en producción.
import { registro } from "@/lib/registro"; // Sistema de registro (logging).

// ═══════════════════════════════════════════════════════════════
//  SISTEMA CENTRALIZADO DE ERRORES
//  Objetivo: que TODOS los endpoints respondan con la misma forma,
//  con el código HTTP correcto, y sin filtrar jamás detalles
//  internos (rutas, SQL, secretos) al cliente en producción.
// ═══════════════════════════════════════════════════════════════

/**
 * Códigos de error estables que el frontend puede interpretar.
 * Son texto, no números, para que se entiendan al leer una respuesta.
 */
export type CodigoError =
  | "DATOS_INVALIDOS" // 422 · el cuerpo o los parámetros no pasan validación
  | "PETICION_INVALIDA" // 400 · petición mal formada (JSON roto, etc.)
  | "NO_AUTENTICADO" // 401 · no hay sesión
  | "NO_AUTORIZADO" // 403 · hay sesión pero sin permisos
  | "NO_ENCONTRADO" // 404 · el recurso no existe
  | "CONFLICTO" // 409 · choca con el estado actual (duplicado, sin stock)
  | "DEMASIADAS_PETICIONES" // 429 · límite de frecuencia superado
  | "ERROR_INTERNO"; // 500 · fallo inesperado del servidor

/** Correspondencia entre cada código y su estado HTTP. */
const ESTADO_HTTP: Record<CodigoError, number> = {
  DATOS_INVALIDOS: 422,
  PETICION_INVALIDA: 400,
  NO_AUTENTICADO: 401,
  NO_AUTORIZADO: 403,
  NO_ENCONTRADO: 404,
  CONFLICTO: 409,
  DEMASIADAS_PETICIONES: 429,
  ERROR_INTERNO: 500,
};

/**
 * Error de aplicación: el que lanzamos a propósito cuando una regla
 * de negocio no se cumple. Se distingue de un fallo inesperado porque
 * su mensaje SÍ es seguro de enseñar al usuario.
 */
export class ErrorApp extends Error {
  /** Código estable que identifica el tipo de error. */
  public readonly codigo: CodigoError;
  /** Detalles opcionales (por ejemplo, errores campo a campo). */
  public readonly detalles?: Record<string, string[]>;

  constructor(
    codigo: CodigoError,
    mensaje: string,
    detalles?: Record<string, string[]>,
  ) {
    super(mensaje); // Guarda el mensaje en la clase Error base.
    this.name = "ErrorApp"; // Nombre útil al depurar.
    this.codigo = codigo; // Tipo de error.
    this.detalles = detalles; // Información adicional opcional.
  }
}

// ─── Atajos para los errores más frecuentes ────────────────────
// Evitan repetir el constructor y uniforman los mensajes.

/** 401 · El usuario no ha iniciado sesión. */
export const noAutenticado = () =>
  new ErrorApp("NO_AUTENTICADO", "Debes iniciar sesión para continuar");

/** 403 · El usuario está identificado pero no tiene permiso. */
export const noAutorizado = () =>
  new ErrorApp("NO_AUTORIZADO", "No tienes permiso para realizar esta acción");

/** 404 · El recurso solicitado no existe. */
export const noEncontrado = (recurso = "El recurso") =>
  new ErrorApp("NO_ENCONTRADO", `${recurso} no existe`);

/** 409 · La operación choca con el estado actual de los datos. */
export const conflicto = (mensaje: string) =>
  new ErrorApp("CONFLICTO", mensaje);

/** 422 · Los datos recibidos no superan la validación. */
export const datosInvalidos = (
  mensaje: string,
  detalles?: Record<string, string[]>,
) => new ErrorApp("DATOS_INVALIDOS", mensaje, detalles);

/**
 * Construye la respuesta JSON de error.
 * Forma siempre idéntica: `{ error, codigo, detalles?, incidencia? }`.
 */
function respuestaError(
  codigo: CodigoError,
  mensaje: string,
  detalles?: Record<string, string[]>,
  idIncidencia?: string,
  cabeceras?: HeadersInit,
) {
  return NextResponse.json(
    {
      error: mensaje, // Texto pensado para enseñar al usuario.
      codigo, // Código estable para que lo interprete el frontend.
      ...(detalles ? { detalles } : {}), // Errores por campo, si los hay.
      ...(idIncidencia ? { incidencia: idIncidencia } : {}), // Referencia de soporte.
    },
    { status: ESTADO_HTTP[codigo], headers: cabeceras },
  );
}

/**
 * Traductor final de errores a respuestas HTTP.
 * Se usa en el `catch` de cada endpoint para no repetir lógica.
 *
 * @param error   Lo que se ha capturado (de cualquier tipo).
 * @param contexto Etiqueta para el registro, p. ej. "auth/login".
 */
export function manejarError(error: unknown, contexto: string): NextResponse {
  // ─── Caso 1: error de validación de Zod ──────────────────────
  if (error instanceof ZodError) {
    // Agrupamos los mensajes por campo para que el formulario los pinte.
    const detalles: Record<string, string[]> = {};
    for (const incidencia of error.issues) {
      const campo = incidencia.path.join(".") || "_"; // "_" = error general
      detalles[campo] ??= []; // Inicializa el array si no existía.
      detalles[campo].push(incidencia.message); // Añade el mensaje.
    }
    return respuestaError(
      "DATOS_INVALIDOS",
      "Revisa los datos introducidos",
      detalles,
    );
  }

  // ─── Caso 2: error de aplicación previsto ────────────────────
  if (error instanceof ErrorApp) {
    // Sólo registramos los de servidor; los de usuario son ruido.
    if (ESTADO_HTTP[error.codigo] >= 500) {
      registro.error(contexto, error.message, error);
    }
    return respuestaError(error.codigo, error.message, error.detalles);
  }

  // ─── Caso 3: JSON mal formado en el cuerpo de la petición ────
  if (error instanceof SyntaxError) {
    return respuestaError(
      "PETICION_INVALIDA",
      "El cuerpo de la petición no es JSON válido",
    );
  }

  // ─── Caso 4: la base de datos no coincide con el código ──────
  // Código 42703 de PostgreSQL = "no existe la columna". Casi siempre
  // significa lo mismo: se ha desplegado código nuevo sin aplicar la
  // migración correspondiente. El mensaje por defecto ("Failed query:
  // select id, name...") no le dice nada a nadie, así que lo
  // traducimos a la instrucción concreta que resuelve el problema.
  if (esErrorDeEsquema(error)) {
    const idIncidencia = randomUUID();
    registro.error(
      contexto,
      "La base de datos no tiene la estructura que espera el código. " +
        "Falta aplicar una migración (npx drizzle-kit push).",
      error,
      { idIncidencia },
    );

    return respuestaError(
      "ERROR_INTERNO",
      CONFIG.esProduccion
        ? "Ha ocurrido un error interno. Inténtalo de nuevo en unos instantes."
        : // En desarrollo se dice exactamente qué hacer.
          "La base de datos está desactualizada: le falta alguna columna " +
            "que el código ya usa. Ejecuta «npx drizzle-kit push» para " +
            "aplicar los cambios pendientes del esquema.",
      undefined,
      idIncidencia,
    );
  }

  // ─── Caso 5: fallo inesperado ────────────────────────────────
  // Generamos un identificador único que damos al usuario y guardamos
  // en el registro: así soporte puede localizar el fallo exacto sin
  // que el usuario vea ni rastros de pila ni rutas internas.
  const idIncidencia = randomUUID();
  registro.error(contexto, "Error no controlado", error, { idIncidencia });

  return respuestaError(
    "ERROR_INTERNO",
    CONFIG.esProduccion
      ? // En producción: mensaje genérico + referencia para soporte.
        "Ha ocurrido un error interno. Inténtalo de nuevo en unos instantes."
      : // En desarrollo: el mensaje real, que ayuda a depurar.
        `Error interno: ${error instanceof Error ? error.message : String(error)}`,
    undefined,
    idIncidencia,
  );
}

/**
 * Respuesta específica para el limitador de peticiones (429).
 * Incluye la cabecera estándar `Retry-After` en segundos.
 */
export function respuestaLimiteExcedido(segundosEspera: number) {
  return respuestaError(
    "DEMASIADAS_PETICIONES",
    `Demasiados intentos. Vuelve a probar en ${segundosEspera} segundos.`,
    undefined,
    undefined,
    { "Retry-After": String(segundosEspera) },
  );
}


/**
 * ¿Es este error un desajuste entre el código y el esquema de la BD?
 *
 * Códigos de PostgreSQL que delatan una migración sin aplicar:
 *   42703 · no existe la columna
 *   42P01 · no existe la tabla
 *   42704 · no existe el objeto (tipo, índice…)
 *
 * El error real viene envuelto por Drizzle, así que hay que mirar
 * también dentro de `cause`, que es donde queda el error original de
 * `pg`.
 */
function esErrorDeEsquema(error: unknown): boolean {
  const CODIGOS_ESQUEMA = ["42703", "42P01", "42704"];

  // Lee la propiedad `code` de un objeto, si la tiene.
  const leerCodigo = (valor: unknown): string | undefined => {
    if (typeof valor !== "object" || valor === null) return undefined;
    const codigo = (valor as { code?: unknown }).code;
    return typeof codigo === "string" ? codigo : undefined;
  };

  // El propio error.
  if (CODIGOS_ESQUEMA.includes(leerCodigo(error) ?? "")) return true;

  // El error original que Drizzle ha envuelto.
  if (typeof error === "object" && error !== null && "cause" in error) {
    const causa = (error as { cause?: unknown }).cause;
    if (CODIGOS_ESQUEMA.includes(leerCodigo(causa) ?? "")) return true;
  }

  return false;
}
