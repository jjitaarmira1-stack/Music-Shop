import "server-only"; // Sólo servidor.
import crypto from "node:crypto"; // Para el código aleatorio del pedido.
import { and, desc, eq, sql } from "drizzle-orm"; // Constructores de consulta.
import { db } from "@/db"; // Conexión.
import { orders, products, type OrderItem } from "@/db/schema"; // Tablas y tipos.
import { BUSINESS } from "@/lib/business"; // Prefijo del código de pedido.
import { conflicto, noEncontrado } from "@/lib/errores"; // Errores tipados.
import { registro } from "@/lib/registro"; // Registro.
import type { DatosCrearPedido } from "@/lib/validaciones"; // Tipo ya validado.

// ═══════════════════════════════════════════════════════════════
//  SERVICIO DE PEDIDOS
//  La lógica de negocio vive aquí y NO dentro del endpoint HTTP.
//  Ventajas: se puede probar sin levantar un servidor, reutilizar
//  desde otro punto de entrada y leer sin ruido de peticiones.
// ═══════════════════════════════════════════════════════════════

/**
 * Genera el código visible de un pedido: `JPR-2026-A1B2C3`.
 * Usa bytes criptográficamente aleatorios (no `Math.random`) para que
 * nadie pueda adivinar el código de otro pedido.
 */
function generarCodigoPedido(): string {
  const anio = new Date().getFullYear(); // Año actual.
  const aleatorio = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 caracteres.
  return `${BUSINESS.orderPrefix}-${anio}-${aleatorio}`;
}

/** Datos necesarios para crear un pedido. */
export interface EntradaCrearPedido extends DatosCrearPedido {
  /** Identificador del usuario, o `null` si compra como invitado. */
  usuarioId: string | null;
}

/**
 * Crea un pedido de forma segura y atómica.
 *
 * ── EL PROBLEMA QUE RESUELVE (fallo crítico C-3) ──────────────
 * La versión anterior hacía:
 *    1. SELECT stock           → "hay 1 unidad, adelante"
 *    2. UPDATE stock = stock-1 → descuenta
 * Entre el paso 1 y el 2 cabían otras peticiones. Con 8 peticiones
 * simultáneas sobre un stock de 1 se crearon 4 pedidos y el stock
 * terminó en −3: se vendió inventario inexistente.
 *
 * ── LA SOLUCIÓN ───────────────────────────────────────────────
 * Una sola sentencia atómica por producto:
 *    UPDATE products SET stock = stock - $qty
 *     WHERE id = $id AND stock >= $qty
 *    RETURNING *
 * PostgreSQL bloquea la fila mientras la actualiza, así que la
 * comprobación y el descuento son indivisibles. Si otra transacción
 * se adelantó, la condición `stock >= qty` ya no se cumple, no se
 * actualiza ninguna fila y abortamos el pedido.
 *
 * Los productos se procesan ORDENADOS por identificador: al tomar
 * todos los bloqueos en el mismo orden se evitan los interbloqueos
 * (deadlocks) entre pedidos que comparten artículos.
 */
export async function crearPedido(entrada: EntradaCrearPedido) {
  const { customerName, customerEmail, address, items, usuarioId } = entrada;

  // ─── Unificar líneas repetidas ───────────────────────────────
  // Si el carrito trae dos veces el mismo producto, se suman. Sin esto
  // se intentaría bloquear la misma fila dos veces en una transacción.
  const cantidadPorProducto = new Map<string, number>();
  for (const linea of items) {
    const acumulado = cantidadPorProducto.get(linea.productId) ?? 0;
    cantidadPorProducto.set(linea.productId, acumulado + linea.qty);
  }

  // Ordenamos por identificador: orden estable de bloqueo.
  const lineasOrdenadas = [...cantidadPorProducto.entries()].sort(
    ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
  );

  // ─── Transacción ─────────────────────────────────────────────
  // Todo lo de dentro se confirma junto o no se confirma nada.
  return db.transaction(async (tx) => {
    const lineasPedido: OrderItem[] = []; // Líneas ya confirmadas.
    let totalCentimos = 0; // Importe acumulado.

    for (const [productoId, cantidad] of lineasOrdenadas) {
      // ── Descuento atómico de stock ──────────────────────────
      // La condición `stock >= cantidad` va DENTRO del UPDATE: esa es
      // la clave de todo. Si no hay unidades, no se actualiza nada.
      const [actualizado] = await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${cantidad}` })
        .where(
          and(
            eq(products.id, productoId), // El producto pedido…
            sql`${products.stock} >= ${cantidad}`, // …y sólo si queda stock.
          ),
        )
        .returning(); // Devuelve la fila ya actualizada.

      // Si no vuelve nada, hay dos posibilidades: el producto no existe
      // o se quedó sin unidades. Consultamos para dar un mensaje útil.
      if (!actualizado) {
        const [existente] = await tx
          .select({
            nombre: products.name,
            stock: products.stock,
          })
          .from(products)
          .where(eq(products.id, productoId))
          .limit(1);

        // Caso A: el producto ya no está en el catálogo.
        if (!existente) {
          throw noEncontrado("Uno de los instrumentos del carrito");
        }

        // Caso B: no hay unidades suficientes. Al lanzar el error se
        // deshace la transacción entera, incluidos los descuentos ya
        // aplicados a otros productos de este mismo pedido.
        registro.info("pedidos", "Pedido rechazado por falta de stock", {
          productoId,
          solicitado: cantidad,
          disponible: existente.stock,
        });
        throw conflicto(
          existente.stock === 0
            ? `«${existente.nombre}» se ha agotado mientras completabas el pedido`
            : `Sólo quedan ${existente.stock} unidades de «${existente.nombre}»`,
        );
      }

      // ── Congelar los datos de la línea ──────────────────────
      // El precio se toma de la BASE DE DATOS, nunca del navegador:
      // así nadie puede manipular el importe desde el cliente.
      lineasPedido.push({
        productId: actualizado.id,
        slug: actualizado.slug,
        name: actualizado.name,
        priceCents: actualizado.priceCents, // Precio real del servidor.
        qty: cantidad,
        image: actualizado.image,
      });

      // Sumamos al total usando el precio verificado.
      totalCentimos += actualizado.priceCents * cantidad;
    }

    // ─── Insertar el pedido ──────────────────────────────────
    const [pedidoCreado] = await tx
      .insert(orders)
      .values({
        code: generarCodigoPedido(), // Código visible.
        userId: usuarioId, // Puede ser null (invitado).
        customerName, // Ya validado y recortado por Zod.
        customerEmail, // Ya normalizado a minúsculas por Zod.
        address,
        items: lineasPedido, // Copia congelada.
        totalCents: totalCentimos, // Total calculado en servidor.
        status: "pagado", // Entorno de demostración: se da por cobrado.
      })
      .returning();

    registro.info("pedidos", "Pedido creado", {
      codigo: pedidoCreado.code,
      lineas: lineasPedido.length,
      totalCentimos,
    });

    return pedidoCreado;
  });
}

/**
 * Lista los pedidos de UN usuario concreto.
 * El filtro por `userId` se aplica en la consulta SQL, que es lo que
 * impide el acceso a pedidos ajenos (IDOR).
 *
 * @param usuarioId Identificador del usuario dueño de los pedidos.
 * @param limite    Máximo de resultados (paginación básica).
 */
export async function listarPedidosDeUsuario(usuarioId: string, limite = 50) {
  return db
    .select()
    .from(orders)
    .where(eq(orders.userId, usuarioId)) // Filtro de propiedad.
    .orderBy(desc(orders.createdAt)) // Del más reciente al más antiguo.
    .limit(limite); // Tope de seguridad.
}

/**
 * Lista todos los pedidos (sólo para administradores).
 * Quien llama debe haber comprobado el rol con `exigirAdmin()`.
 */
export async function listarTodosLosPedidos(limite = 100, desplazamiento = 0) {
  return db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(limite) // Nunca se devuelve la tabla entera.
    .offset(desplazamiento); // Para paginar.
}

/**
 * Cambia el estado de un pedido (sólo administradores).
 *
 * @param pedidoId Identificador del pedido (ya validado como UUID).
 * @param estado   Nuevo estado (ya validado contra la lista permitida).
 * @throws ErrorApp 404 si el pedido no existe.
 */
export async function actualizarEstadoPedido(
  pedidoId: string,
  estado: (typeof orders.$inferSelect)["status"],
) {
  const [actualizado] = await db
    .update(orders)
    .set({ status: estado })
    .where(eq(orders.id, pedidoId))
    .returning();

  if (!actualizado) throw noEncontrado("El pedido");

  registro.info("pedidos", "Estado de pedido actualizado", {
    codigo: actualizado.code,
    estado,
  });

  return actualizado;
}
