// ═══════════════════════════════════════════════════════════════
//  CLIENTE HTTP DEL NAVEGADOR
//
//  Antes, cada componente repetía el mismo bloque `fetch` + `json()`
//  + `toast.error` (unas doce veces). Ninguno tenía TIEMPO DE ESPERA
//  ni REINTENTOS: si la red se colgaba, el indicador de carga giraba
//  para siempre y el usuario se quedaba mirando.
//
//  Este módulo centraliza todo eso:
//   · tiempo máximo de espera configurable,
//   · reintentos con espera creciente SÓLO cuando tiene sentido,
//   · traducción de los errores a mensajes en castellano,
//   · tipado del resultado.
// ═══════════════════════════════════════════════════════════════

/** Error de una petición, con la información útil ya extraída. */
export class ErrorPeticion extends Error {
  /** Código HTTP devuelto (0 si la petición no llegó a completarse). */
  public readonly estado: number;
  /** Código estable de la aplicación, p. ej. "DATOS_INVALIDOS". */
  public readonly codigo?: string;
  /** Errores por campo, para pintarlos junto a cada entrada del formulario. */
  public readonly detalles?: Record<string, string[]>;

  constructor(
    mensaje: string,
    estado: number,
    codigo?: string,
    detalles?: Record<string, string[]>,
  ) {
    super(mensaje);
    this.name = "ErrorPeticion";
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

/** Opciones admitidas al hacer una petición. */
export interface OpcionesPeticion {
  /** Método HTTP. Por defecto "GET". */
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Cuerpo: un objeto (se convierte a JSON) o un FormData (se envía tal cual). */
  body?: unknown;
  /** Milisegundos antes de abortar. Por defecto 15.000 (15 s). */
  tiempoMaximo?: number;
  /** Reintentos ante fallos pasajeros. Por defecto 2. */
  reintentos?: number;
  /** Señal externa para cancelar (por ejemplo, al desmontar un componente). */
  signal?: AbortSignal;
}

/** Espera un número de milisegundos. */
const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

/**
 * Decide si merece la pena reintentar según el código de estado.
 *
 * Se reintenta SÓLO en fallos pasajeros:
 *  · 408 tiempo de espera agotado,
 *  · 429 demasiadas peticiones,
 *  · 500, 502, 503, 504 errores de servidor o de pasarela.
 *
 * NUNCA se reintenta un 4xx de cliente (400, 401, 403, 404, 409, 422):
 * si los datos están mal, repetir la petición dará exactamente el
 * mismo resultado y sólo añade carga inútil.
 */
function conviensReintentar(estado: number): boolean {
  return [408, 429, 500, 502, 503, 504].includes(estado);
}

/**
 * Realiza una petición JSON con tiempo de espera y reintentos.
 *
 * @param url      Ruta relativa, p. ej. "/api/products".
 * @param opciones Ajustes de la petición.
 * @returns El cuerpo de la respuesta ya convertido al tipo `T`.
 * @throws ErrorPeticion con un mensaje listo para mostrar al usuario.
 */
export async function peticionJson<T = unknown>(
  url: string,
  opciones: OpcionesPeticion = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    tiempoMaximo = 15_000,
    reintentos = 2,
    signal: senalExterna,
  } = opciones;

  // El cuerpo puede ser FormData (subidas) u objeto normal (JSON).
  const esFormData = typeof FormData !== "undefined" && body instanceof FormData;

  // Guardamos el último error para relanzarlo si se agotan los intentos.
  let ultimoError: Error = new ErrorPeticion("Error desconocido", 0);

  // Bucle de intentos: el primero más `reintentos` adicionales.
  for (let intento = 0; intento <= reintentos; intento += 1) {
    // Un controlador NUEVO en cada intento: uno abortado no se reutiliza.
    const controlador = new AbortController();

    // Temporizador que aborta la petición si tarda demasiado. Esto es
    // lo que impide que el indicador de carga gire indefinidamente.
    const temporizador = setTimeout(() => controlador.abort(), tiempoMaximo);

    // Si quien llama cancela (por ejemplo, al desmontar el componente),
    // propagamos la cancelación a nuestro controlador interno.
    const alCancelar = () => controlador.abort();
    senalExterna?.addEventListener("abort", alCancelar);

    try {
      const respuesta = await fetch(url, {
        method,
        // FormData fija su propia cabecera con el separador: no la tocamos.
        headers: esFormData
          ? undefined
          : body !== undefined
            ? { "Content-Type": "application/json" }
            : undefined,
        body: esFormData
          ? (body as FormData)
          : body !== undefined
            ? JSON.stringify(body)
            : undefined,
        // Envía la cookie de sesión (mismo origen).
        credentials: "same-origin",
        signal: controlador.signal,
      });

      // Intentamos leer el cuerpo como JSON. Si la respuesta viene
      // vacía o es HTML (una página de error de un proxy), no rompemos.
      let datos: unknown = null;
      const tipoContenido = respuesta.headers.get("content-type") ?? "";
      if (tipoContenido.includes("application/json")) {
        datos = await respuesta.json().catch(() => null);
      }

      // ─── Respuesta correcta ──────────────────────────────────
      if (respuesta.ok) return datos as T;

      // ─── Respuesta de error ──────────────────────────────────
      const cuerpoError = (datos ?? {}) as {
        error?: string;
        codigo?: string;
        detalles?: Record<string, string[]>;
      };

      const error = new ErrorPeticion(
        cuerpoError.error ?? `Error ${respuesta.status}`,
        respuesta.status,
        cuerpoError.codigo,
        cuerpoError.detalles,
      );

      // Si el error no es recuperable, fallamos ya: no tiene sentido insistir.
      if (!conviensReintentar(respuesta.status) || intento === reintentos) {
        throw error;
      }

      ultimoError = error;
    } catch (error) {
      // Cancelación deliberada desde fuera: se propaga sin reintentar.
      if (senalExterna?.aborted) throw error;

      // Tiempo de espera agotado (nuestro propio abort).
      if (error instanceof DOMException && error.name === "AbortError") {
        ultimoError = new ErrorPeticion(
          "La conexión ha tardado demasiado. Comprueba tu red e inténtalo de nuevo.",
          408,
        );
      } else if (error instanceof ErrorPeticion) {
        // Error ya procesado: si llegó aquí, es que sí se puede reintentar.
        ultimoError = error;
      } else {
        // Fallo de red puro: sin conexión, DNS caído, servidor apagado…
        ultimoError = new ErrorPeticion(
          "No se pudo conectar con el servidor. Revisa tu conexión a internet.",
          0,
        );
      }

      // Si era el último intento, propagamos el error.
      if (intento === reintentos) throw ultimoError;
    } finally {
      // Limpieza en todos los casos: temporizador y escucha de cancelación.
      clearTimeout(temporizador);
      senalExterna?.removeEventListener("abort", alCancelar);
    }

    // ─── Espera antes del siguiente intento ────────────────────
    // Retroceso exponencial (400 ms, 800 ms…) con un pequeño margen
    // aleatorio para que varios clientes no reintenten a la vez.
    const espera = 400 * 2 ** intento + Math.random() * 200;
    await esperar(espera);
  }

  // Sólo se llega aquí si se agotan todos los intentos.
  throw ultimoError;
}
