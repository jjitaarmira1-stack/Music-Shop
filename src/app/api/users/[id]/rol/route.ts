import { NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/auth";
import { verificarOrigen } from "@/lib/csrf";
import { manejarError } from "@/lib/errores";
import { esquemaCambiarRol, esquemaUuid } from "@/lib/validaciones";
import { cambiarRolUsuario } from "@/servicios/usuarios";

export const dynamic = "force-dynamic";

type Parametros = { params: Promise<{ id: string }> };

/**
 * PATCH /api/users/[id]/rol · Cambiar el rol de una cuenta (SÓLO admin)
 *
 * Misma cadena de comprobaciones que el resto de endpoints sensibles:
 * origen → permisos → identificador → cuerpo → regla de negocio.
 *
 * El servicio rechaza con un 409 dos casos peligrosos: quitarse el rol
 * a uno mismo y dejar la tienda sin ningún administrador.
 */
export async function PATCH(peticion: Request, { params }: Parametros) {
  try {
    // 1. Que la petición venga de nuestro propio sitio (anti-CSRF).
    verificarOrigen(peticion);

    // 2. Sólo administradores. Guardamos la sesión: hace falta saber
    //    QUIÉN ejecuta la acción para las protecciones del servicio.
    const sesion = await exigirAdmin();

    // 3. El identificador debe ser un UUID válido.
    const { id } = await params;
    const idValidado = esquemaUuid.parse(id);

    // 4. Del cuerpo sólo se acepta `role`, contra una lista cerrada.
    const cuerpo = await peticion.json();
    const { role } = esquemaCambiarRol.parse(cuerpo);

    // 5. Cambio efectivo. Invalida también las sesiones del afectado.
    const usuario = await cambiarRolUsuario(idValidado, role, sesion.uid);

    return NextResponse.json({ user: usuario });
  } catch (error) {
    return manejarError(error, "users/rol/PATCH");
  }
}
