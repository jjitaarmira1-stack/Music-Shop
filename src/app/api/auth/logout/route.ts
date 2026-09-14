import { NextResponse } from "next/server";
import { limpiarCookieSesion, obtenerSesion } from "@/lib/auth";
import { manejarError } from "@/lib/errores";
import { verificarOrigen } from "@/lib/csrf";
import { registro } from "@/lib/registro";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout · Cerrar sesión
 *
 * Es POST y no GET a propósito: una petición GET puede dispararla
 * cualquier etiqueta <img> de otra web y cerraría la sesión del
 * usuario sin que él lo pidiera (CSRF de cierre de sesión).
 */
export async function POST(peticion: Request) {
  try {
    // Aunque cerrar sesión no sea destructivo, verificamos el origen
    // por coherencia con el resto de mutaciones.
    verificarOrigen(peticion);

    // Leemos la sesión antes de borrarla, sólo para poder registrarla.
    const sesion = await obtenerSesion();

    // Borramos la cookie: el navegador deja de enviarla.
    await limpiarCookieSesion();

    if (sesion) {
      registro.info("auth/logout", "Sesión cerrada", { uid: sesion.uid });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return manejarError(error, "auth/logout");
  }
}
