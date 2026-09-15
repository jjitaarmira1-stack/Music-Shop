import { NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/auth";
import { manejarError } from "@/lib/errores";
import { listarUsuarios } from "@/servicios/usuarios";

// Los datos de usuarios cambian con cada alta: nunca se cachean.
export const dynamic = "force-dynamic";

/**
 * GET /api/users · Listado de cuentas (SÓLO admin)
 *
 * Devuelve nombre, correo, rol, fecha de alta y número de pedidos.
 * El hash de la contraseña NO sale de aquí: el servicio selecciona
 * columnas de forma explícita y el tipo `UsuarioPublico` lo impide
 * también en tiempo de compilación.
 */
export async function GET() {
  try {
    // Control de acceso primero: sin sesión de administrador, 401/403.
    await exigirAdmin();

    const usuarios = await listarUsuarios();

    // Contrato en inglés, como el resto de endpoints de la aplicación.
    return NextResponse.json({ users: usuarios });
  } catch (error) {
    return manejarError(error, "users/GET");
  }
}
