import { NextResponse } from "next/server";
import { esquemaActualizarPedido, esquemaUuid } from "@/lib/validaciones";
import { actualizarEstadoPedido } from "@/servicios/pedidos";
import { exigirAdmin } from "@/lib/auth";
import { manejarError } from "@/lib/errores";
import { verificarOrigen } from "@/lib/csrf";

export const dynamic = "force-dynamic";

type Parametros = { params: Promise<{ id: string }> };

/**
 * PATCH /api/orders/[id] · Cambiar el estado de un pedido (SÓLO admin)
 *
 * El estado se valida contra una lista cerrada: pendiente, pagado,
 * enviado, entregado o cancelado. Cualquier otro valor da un 422.
 */
export async function PATCH(peticion: Request, { params }: Parametros) {
  try {
    // 1. Origen de confianza.
    verificarOrigen(peticion);

    // 2. Sólo administradores pueden mover el estado de un pedido.
    await exigirAdmin();

    // 3. Identificador validado como UUID.
    const { id } = await params;
    const idValidado = esquemaUuid.parse(id);

    // 4. Estado validado contra la lista permitida.
    const cuerpo = await peticion.json();
    const { status } = esquemaActualizarPedido.parse(cuerpo);

    // 5. Actualización (404 si el pedido no existe).
    const pedido = await actualizarEstadoPedido(idValidado, status);

    return NextResponse.json({ order: pedido });
  } catch (error) {
    return manejarError(error, "orders/PATCH");
  }
}
