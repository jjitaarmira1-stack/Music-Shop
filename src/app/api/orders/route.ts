import { NextResponse } from "next/server";
import { esquemaCrearPedido } from "@/lib/validaciones";
import {
  crearPedido,
  listarPedidosDeUsuario,
  listarTodosLosPedidos,
} from "@/servicios/pedidos";
import { exigirSesion, obtenerSesion } from "@/lib/auth";
import { manejarError, respuestaLimiteExcedido } from "@/lib/errores";
import { comprobarLimite, obtenerIp } from "@/lib/limitador";
import { verificarOrigen } from "@/lib/csrf";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders · Listar pedidos
 *
 * Control de acceso por rol:
 *  · administrador → todos los pedidos,
 *  · cliente       → únicamente los suyos.
 *
 * El filtro por `userId` se aplica en la CONSULTA SQL, no en el
 * navegador: es lo que impide que un cliente vea pedidos ajenos
 * cambiando un parámetro (IDOR).
 */
export async function GET(peticion: Request) {
  try {
    // Exige sesión: sin ella, 401.
    const sesion = await exigirSesion();

    // Paginación con topes máximos.
    const { searchParams } = new URL(peticion.url);
    const limite = Math.min(Number(searchParams.get("limit")) || 50, 100);

    const pedidos =
      sesion.role === "admin"
        ? await listarTodosLosPedidos(limite) // Vista completa.
        : await listarPedidosDeUsuario(sesion.uid, limite); // Sólo los propios.

    return NextResponse.json(
      { orders: pedidos },
      // Datos personales: no deben quedar en ninguna caché.
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    return manejarError(error, "orders/GET");
  }
}

/**
 * POST /api/orders · Confirmar un pedido
 *
 * Se permite comprar sin cuenta (invitado), igual que antes.
 *
 * El control de stock y el cálculo del importe viven en el servicio
 * `crearPedido`, que descuenta las unidades de forma ATÓMICA. Esa es
 * la corrección del fallo crítico verificado en la auditoría, donde
 * 8 peticiones simultáneas sobre un stock de 1 crearon 4 pedidos y
 * dejaron el inventario en −3.
 */
export async function POST(peticion: Request) {
  try {
    // 1. Origen de confianza.
    verificarOrigen(peticion);

    // 2. Límite por IP: evita el envío masivo de pedidos falsos.
    const ip = obtenerIp(peticion);
    const limite = comprobarLimite(`pedidos:crear:${ip}`, 10, 300);
    if (!limite.permitido) return respuestaLimiteExcedido(limite.segundosEspera);

    // 3. Sesión OPCIONAL: se admite la compra como invitado.
    const sesion = await obtenerSesion();

    // 4. Validación completa del cuerpo. Aquí se rechazan los correos
    //    inválidos que antes se aceptaban ("no-es-un-email"), las
    //    cantidades absurdas y los identificadores mal formados.
    const cuerpo = await peticion.json();
    const datos = esquemaCrearPedido.parse(cuerpo);

    // 5. Creación del pedido dentro de una transacción atómica.
    const pedido = await crearPedido({
      ...datos,
      usuarioId: sesion?.uid ?? null, // null si es invitado.
    });

    return NextResponse.json({ order: pedido }, { status: 201 });
  } catch (error) {
    return manejarError(error, "orders/POST");
  }
}
