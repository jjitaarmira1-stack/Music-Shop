import { NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/auth";
import { verificarOrigen } from "@/lib/csrf";
import { manejarError } from "@/lib/errores";
import { esquemaUuid } from "@/lib/validaciones";
import { restablecerContrasenaUsuario } from "@/servicios/usuarios";

export const dynamic = "force-dynamic";

type Parametros = { params: Promise<{ id: string }> };

/**
 * POST /api/users/[id]/contrasena · Restablecer contraseña (SÓLO admin)
 *
 * Genera una contraseña aleatoria, guarda su hash Argon2id y la
 * devuelve UNA SOLA VEZ para que el administrador se la entregue a la
 * persona por un canal seguro. No se almacena en claro en ningún sitio
 * ni aparece en los registros.
 *
 * Es un POST y no un GET porque modifica datos: un GET podría acabar
 * en el historial del navegador, en un enlace precargado o en la caché
 * de un proxy, y bastaría con visitar una URL para cambiar una
 * contraseña ajena.
 *
 * Importante: al restablecer se cierran todas las sesiones abiertas de
 * esa cuenta, de modo que un posible intruso queda fuera al instante.
 */
export async function POST(peticion: Request, { params }: Parametros) {
  try {
    // 1. Origen de confianza (anti-CSRF).
    verificarOrigen(peticion);

    // 2. Sólo administradores.
    const sesion = await exigirAdmin();

    // 3. Identificador validado.
    const { id } = await params;
    const idValidado = esquemaUuid.parse(id);

    // 4. Generación + guardado del hash.
    const { usuario, contrasenaTemporal } = await restablecerContrasenaUsuario(
      idValidado,
      sesion.uid,
    );

    // La contraseña viaja una única vez, por HTTPS, hacia el panel.
    return NextResponse.json({
      user: usuario,
      temporaryPassword: contrasenaTemporal,
    });
  } catch (error) {
    return manejarError(error, "users/contrasena/POST");
  }
}
