import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { manejarError } from "@/lib/errores";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me · Datos de la sesión actual
 *
 * Lo usa el proveedor de sesión del navegador para saber quién está
 * conectado. Devuelve `{ user: null }` cuando no hay sesión, en lugar
 * de un 401: para esta consulta "no haber iniciado sesión" es una
 * respuesta normal, no un error.
 *
 * Sólo se exponen cuatro campos (uid, nombre, correo y rol). El hash
 * de la contraseña y la fecha de alta no salen nunca de aquí.
 */
export async function GET() {
  try {
    const sesion = await obtenerSesion();

    // Cabecera de caché explícita: los datos de sesión no deben
    // almacenarse en ningún proxy ni en la caché del navegador.
    return NextResponse.json(
      { user: sesion },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    return manejarError(error, "auth/me");
  }
}
