import "server-only"; // Sólo servidor.

// ═══════════════════════════════════════════════════════════════
//  CAPA DE COMPATIBILIDAD
//
//  La lógica de acceso a datos se ha reorganizado en servicios por
//  dominio, dentro de `src/servicios/`:
//     · productos.ts → catálogo y estadísticas
//     · pedidos.ts   → pedidos y control de stock
//     · usuarios.ts  → cuentas y autenticación
//
//  Este archivo se mantiene para que las páginas que ya existían
//  sigan funcionando sin reescribirlas, y para documentar de un
//  vistazo dónde ha ido a parar cada función.
//
//  Al crear código nuevo, importa directamente desde `@/servicios/*`.
// ═══════════════════════════════════════════════════════════════

import {
  buscarProductos,
  obtenerProductoPorSlug,
  obtenerProductosRelacionados,
  obtenerEstadisticas,
  obtenerDatosGraficas,
} from "@/servicios/productos";
import {
  listarPedidosDeUsuario,
  listarTodosLosPedidos,
} from "@/servicios/pedidos";
import { buscarUsuarioParaLogin } from "@/servicios/usuarios";

/** Filtros admitidos al listar el catálogo. */
export interface ProductFilters {
  category?: string;
  q?: string;
  featured?: boolean;
}

/**
 * Lista productos del catálogo.
 *
 * Nota: antes devolvía TODAS las filas sin límite. Ahora usa el
 * servicio paginado por debajo y devuelve la primera página con un
 * tope amplio (60), suficiente para la portada y sin riesgo de
 * agotar la memoria si el catálogo crece.
 */
export async function getProducts(filtros: ProductFilters = {}) {
  const resultado = await buscarProductos({
    // `as never` evita un choque de tipos: la validación real de la
    // categoría la hace Zod en el endpoint correspondiente.
    category: filtros.category as never,
    q: filtros.q,
    featured: filtros.featured ? "1" : undefined,
    page: 1,
    perPage: 60,
  });
  return resultado.productos;
}

/** Obtiene un producto por su slug (o `null`). */
export async function getProductBySlug(slug: string) {
  return obtenerProductoPorSlug(slug);
}

/** Productos relacionados de la misma categoría. */
export async function getRelatedProducts(slug: string, categoria: string) {
  return obtenerProductosRelacionados(slug, categoria);
}

/** Busca un usuario por correo (uso interno del inicio de sesión). */
export async function findUserByEmail(email: string) {
  return buscarUsuarioParaLogin(email);
}

/** Todos los pedidos (sólo administradores). */
export async function getAllOrders() {
  return listarTodosLosPedidos();
}

/** Pedidos de un usuario concreto. */
export async function getOrdersForUser(usuarioId: string) {
  return listarPedidosDeUsuario(usuarioId);
}

/** Estadísticas del panel de administración. */
export async function getAdminStats() {
  return obtenerEstadisticas();
}

/** Datos agregados que alimentan las gráficas del panel. */
export async function getAdminCharts() {
  return obtenerDatosGraficas();
}
