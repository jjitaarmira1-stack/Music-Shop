import "server-only"; // Sólo servidor.
import { registro } from "@/lib/registro"; // Para registrar los intentos.
import { ErrorApp } from "@/lib/errores"; // Error tipado de la aplicación.

// ═══════════════════════════════════════════════════════════════
//  PROTECCIÓN CSRF (Cross-Site Request Forgery)
//
//  El ataque: un sitio malicioso hace que TU navegador envíe una
//  petición a nuestra API. Como el navegador adjunta la cookie de
//  sesión automáticamente, la petición llega autenticada.
//
//  Defensa en dos capas:
//   1. Cookie con `SameSite=Lax` (en lib/auth.ts): el navegador no
//      envía la cookie en peticiones POST/PATCH/DELETE que nacen en
//      otro sitio. Cubre la mayoría de los casos.
//   2. Verificación de origen en el servidor (este archivo): no
//      depende del navegador y protege también a clientes antiguos.
//
//  Se ha elegido la verificación de origen en lugar de tokens
//  sincronizados porque, con cookies `SameSite=Lax`, aporta la misma
//  protección real sin añadir estado ni complicar el frontend
//  (recomendación de la hoja de referencia de OWASP sobre CSRF).
// ═══════════════════════════════════════════════════════════════

/**
 * Métodos HTTP que modifican datos y, por tanto, hay que proteger.
 * GET y HEAD son de sólo lectura y quedan fuera.
 */
const METODOS_PROTEGIDOS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Extrae el "host" (dominio y puerto) de una URL.
 * @returns El host, o `null` si la URL no es válida.
 */
function extraerHost(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host; // p. ej. "midominio.com:443"
  } catch {
    return null; // Cadena que no es una URL.
  }
}

/**
 * Verifica que una petición que modifica datos venga de nuestro sitio.
 *
 * Compara el `Origin` (o, si falta, el `Referer`) con el `Host` real de
 * la petición. Si no coinciden, se rechaza.
 *
 * @param peticion Petición entrante.
 * @throws ErrorApp 403 si el origen no es de confianza.
 */
export function verificarOrigen(peticion: Request): void {
  // Las lecturas no cambian nada: no hace falta protegerlas.
  if (!METODOS_PROTEGIDOS.has(peticion.method)) return;

  // Host al que va dirigida la petición, según la cabecera.
  // `x-forwarded-host` la pone el proxy inverso cuando lo hay.
  const hostDestino =
    peticion.headers.get("x-forwarded-host") ?? peticion.headers.get("host");

  // Origen declarado por el navegador. Es el dato más fiable porque el
  // propio navegador lo rellena y JavaScript no lo puede falsificar.
  const hostOrigen = extraerHost(peticion.headers.get("origin"));

  // Si el navegador no envió `Origin` (sucede en algunos casos),
  // recurrimos a `Referer` como segunda opción.
  const hostReferente = extraerHost(peticion.headers.get("referer"));

  // Host declarado por el cliente: preferimos Origin sobre Referer.
  const hostDeclarado = hostOrigen ?? hostReferente;

  // Caso 1: no hay ni Origin ni Referer.
  // Ocurre con clientes que no son navegadores (curl, apps móviles) y
  // en algunas peticiones del mismo origen. Como la cookie es
  // `SameSite=Lax`, un sitio externo no puede llegar hasta aquí con
  // sesión válida, así que lo dejamos pasar y lo anotamos.
  if (!hostDeclarado) {
    registro.debug("csrf", "Petición sin cabecera Origin ni Referer", {
      metodo: peticion.method,
    });
    return;
  }

  // Caso 2: el origen no coincide con el destino → ataque probable.
  if (hostDeclarado !== hostDestino) {
    registro.seguridad("csrf", "Origen cruzado rechazado", {
      metodo: peticion.method,
      declarado: hostDeclarado,
      destino: hostDestino,
    });
    throw new ErrorApp(
      "NO_AUTORIZADO",
      "Petición rechazada por motivos de seguridad (origen no válido)",
    );
  }

  // Caso 3: coinciden → petición legítima, continúa.
}
