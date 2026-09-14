import { NextResponse, type NextRequest } from "next/server";

// ═══════════════════════════════════════════════════════════════
//  PROXY (antes «middleware») · Primera línea de defensa
//
//  En Next.js 16 el archivo «middleware.ts» pasó a llamarse
//  «proxy.ts»: es la misma idea con el nombre actualizado.
//
//  Se ejecuta ANTES que cualquier página o endpoint. Aquí se hace
//  sólo lo que es barato y no necesita base de datos:
//   · redirigir a /login a quien no traiga cookie de sesión,
//   · añadir cabeceras que dependen de la petición concreta.
//
//  ⚠️ MUY IMPORTANTE: esto NO sustituye a la comprobación de permisos
//  del servidor. Este archivo sólo mira si EXISTE la cookie; no
//  valida su firma (hacerlo aquí obligaría a usar el runtime Edge con
//  criptografía limitada). La verificación de verdad se hace en cada
//  página y endpoint con `exigirSesion()` / `exigirAdmin()`.
//  Aquí sólo evitamos el parpadeo de cargar una página protegida para
//  después echar al usuario.
// ═══════════════════════════════════════════════════════════════

/** Nombre de la cookie de sesión (debe coincidir con lib/auth.ts). */
const NOMBRE_COOKIE = "musicshop_session";

/**
 * Rutas que exigen haber iniciado sesión.
 * El rol concreto se comprueba después, ya en el servidor.
 */
const RUTAS_PRIVADAS = ["/cuenta", "/admin"];

export default function proxy(peticion: NextRequest) {
  const { pathname } = peticion.nextUrl; // Ruta solicitada.

  // ─── ¿Es una ruta privada? ───────────────────────────────────
  const esPrivada = RUTAS_PRIVADAS.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`),
  );

  if (esPrivada) {
    // Miramos si viene la cookie de sesión (sin validar su contenido).
    const tieneCookie = peticion.cookies.has(NOMBRE_COOKIE);

    if (!tieneCookie) {
      // Redirigimos al inicio de sesión conservando el destino, para
      // poder devolver al usuario donde quería ir tras autenticarse.
      const destino = new URL("/login", peticion.url);

      // Sólo se guarda la RUTA interna, nunca una URL completa: así se
      // evita un "open redirect" hacia un dominio externo.
      destino.searchParams.set("next", pathname);

      return NextResponse.redirect(destino);
    }
  }

  // ─── El resto de peticiones siguen su curso ──────────────────
  return NextResponse.next();
}

/**
 * Rutas en las que se ejecuta.
 * Se excluyen los estáticos y las imágenes para no gastar ciclos:
 *  · `_next/static`  → JS y CSS compilados
 *  · `_next/image`   → optimizador de imágenes
 *  · `favicon.ico`, `icon.svg`, `img/` → recursos públicos
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|img/).*)"],
};
