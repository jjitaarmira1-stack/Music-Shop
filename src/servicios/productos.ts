import "server-only"; // Sólo servidor.
import { and, asc, desc, eq, ilike, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db"; // Conexión.
import { products, type NewProduct } from "@/db/schema"; // Tabla y tipos.
import { conflicto, noEncontrado } from "@/lib/errores"; // Errores tipados.
import { registro } from "@/lib/registro"; // Registro.
import type {
  DatosActualizarProducto,
  DatosCrearProducto,
  FiltrosProducto,
} from "@/lib/validaciones"; // Tipos ya validados.

// ═══════════════════════════════════════════════════════════════
//  SERVICIO DE PRODUCTOS
//  Toda la lógica del catálogo, separada del transporte HTTP.
// ═══════════════════════════════════════════════════════════════

/** Imagen que se asigna si no se indica ninguna. */
const IMAGEN_POR_DEFECTO = "/img/products/guitarra-electrica.jpg";

/**
 * Convierte un nombre en un identificador apto para URL.
 * "Guitarra Española Ñ" → "guitarra-espanola-n".
 */
function convertirEnSlug(nombre: string): string {
  return (
    nombre
      .toLowerCase() // Todo en minúsculas.
      .normalize("NFD") // Separa las letras de sus tildes.
      .replace(/[\u0300-\u036f]/g, "") // Elimina las tildes sueltas.
      .replace(/[^a-z0-9]+/g, "-") // Cualquier otro carácter pasa a guion.
      .replace(/(^-|-$)/g, "") // Quita guiones sobrantes de los extremos.
      .slice(0, 80) || "instrumento" // Recorta y evita el resultado vacío.
  );
}

/**
 * Genera un slug único comprobándolo contra la base de datos.
 * El código anterior añadía 4 caracteres al azar y CONFIABA en que no
 * chocaran; aquí se verifica de verdad y se reintenta si hace falta.
 */
async function generarSlugUnico(nombre: string): Promise<string> {
  const base = convertirEnSlug(nombre); // Punto de partida.

  // Primer intento: el slug limpio, que es el más bonito para la URL.
  const [ocupado] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.slug, base))
    .limit(1);

  if (!ocupado) return base; // Libre: lo usamos tal cual.

  // Si está ocupado, probamos con sufijos numéricos: base-2, base-3…
  for (let sufijo = 2; sufijo <= 50; sufijo += 1) {
    const candidato = `${base}-${sufijo}`;
    const [existe] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, candidato))
      .limit(1);
    if (!existe) return candidato;
  }

  // Caso extremo (50 productos con el mismo nombre): añadimos la hora.
  return `${base}-${Date.now().toString(36)}`;
}

/** Resultado paginado del catálogo. */
export interface ResultadoCatalogo {
  /** Productos de la página solicitada. */
  productos: (typeof products.$inferSelect)[];
  /** Total de productos que cumplen el filtro. */
  total: number;
  /** Página actual (empieza en 1). */
  pagina: number;
  /** Elementos por página. */
  porPagina: number;
  /** Número total de páginas. */
  totalPaginas: number;
}

/**
 * Busca productos con filtros y PAGINACIÓN.
 *
 * Antes se devolvía la tabla completa sin límite: con 8 productos no
 * se nota, pero con 5.000 la portada tarda segundos y consume mucha
 * memoria. Ahora nunca se traen más de `porPagina` filas.
 */
export async function buscarProductos(
  filtros: Partial<FiltrosProducto> = {},
): Promise<ResultadoCatalogo> {
  // Valores por defecto, con tope máximo de 60 por página.
  const pagina = filtros.page ?? 1;
  const porPagina = Math.min(filtros.perPage ?? 24, 60);

  // ─── Construcción de las condiciones ─────────────────────────
  // Se acumulan en un array y se combinan con AND. Drizzle genera
  // siempre consultas parametrizadas, así que no hay inyección SQL.
  const condiciones: SQL[] = [];

  // Filtro por categoría ("todos" significa no filtrar).
  if (filtros.category && filtros.category !== "todos") {
    condiciones.push(eq(products.category, filtros.category));
  }

  // Filtro por subcategoría ("todas" significa no filtrar).
  // Se combina con el anterior mediante AND, así que pedir
  // categoría=cuerdas y subcategoría=bajos devuelve sólo los bajos.
  // El índice compuesto (category, subcategory) cubre justo este caso.
  if (filtros.subcategory && filtros.subcategory !== "todas") {
    condiciones.push(eq(products.subcategory, filtros.subcategory));
  }

  // Búsqueda por texto en el nombre.
  if (filtros.q) {
    // Escapamos los comodines de LIKE (% y _) para que una búsqueda de
    // "100%" no se interprete como patrón y devuelva el catálogo entero.
    const textoEscapado = filtros.q
      .trim()
      .replace(/\\/g, "\\\\") // La barra invertida primero.
      .replace(/%/g, "\\%") // Comodín "cualquier texto".
      .replace(/_/g, "\\_"); // Comodín "un carácter".
    // `ilike` = LIKE insensible a mayúsculas. El valor va como parámetro.
    condiciones.push(ilike(products.name, `%${textoEscapado}%`));
  }

  // Sólo destacados.
  if (filtros.featured === "1") {
    condiciones.push(eq(products.featured, true));
  }

  // Cláusula WHERE final (o ninguna si no hay filtros).
  const clausulaWhere = condiciones.length ? and(...condiciones) : undefined;

  // ─── Dos consultas en paralelo: página y total ───────────────
  // `Promise.all` las lanza a la vez en lugar de una detrás de otra.
  const [filas, [conteo]] = await Promise.all([
    db
      .select()
      .from(products)
      .where(clausulaWhere)
      .orderBy(desc(products.featured), asc(products.name)) // Coincide con el índice.
      .limit(porPagina)
      .offset((pagina - 1) * porPagina),
    db
      .select({ valor: sql<number>`count(*)::int` })
      .from(products)
      .where(clausulaWhere),
  ]);

  const total = conteo?.valor ?? 0;

  return {
    productos: filas,
    total,
    pagina,
    porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
  };
}

/**
 * Obtiene un producto por su slug.
 * @returns El producto, o `null` si no existe.
 */
export async function obtenerProductoPorSlug(slug: string) {
  const [producto] = await db
    .select()
    .from(products)
    .where(eq(products.slug, slug))
    .limit(1);
  return producto ?? null;
}

/**
 * Productos relacionados: misma categoría, excluyendo el actual.
 * @param limite Número máximo de sugerencias.
 */
export async function obtenerProductosRelacionados(
  slug: string,
  categoria: string,
  limite = 3,
) {
  return db
    .select()
    .from(products)
    .where(and(eq(products.category, categoria), ne(products.slug, slug)))
    .limit(limite);
}

/**
 * Crea un producto (sólo administradores).
 * Los datos llegan YA validados por Zod desde el endpoint.
 */
export async function crearProducto(datos: DatosCrearProducto) {
  // Slug único verificado contra la base de datos.
  const slug = await generarSlugUnico(datos.name);

  // Construimos la fila de forma EXPLÍCITA campo a campo. Esto cierra
  // el "mass assignment": aunque el cliente enviara `id` o `createdAt`,
  // aquí no se copian nunca.
  const nuevoProducto: NewProduct = {
    slug,
    name: datos.name,
    tagline: datos.tagline,
    description: datos.description,
    category: datos.category,
    // `?? null` porque la columna admite nulos: es un campo opcional.
    subcategory: datos.subcategory ?? null,
    priceCents: datos.priceCents,
    stock: datos.stock,
    image: datos.image ?? IMAGEN_POR_DEFECTO,
    featured: datos.featured,
    specs: datos.specs,
  };

  const [creado] = await db.insert(products).values(nuevoProducto).returning();

  registro.info("productos", "Producto creado", { slug: creado.slug });
  return creado;
}

/**
 * Actualiza un producto (sólo administradores).
 *
 * @param id    Identificador (ya validado como UUID).
 * @param datos Campos a modificar (ya validados).
 * @throws ErrorApp 404 si el producto no existe.
 */
export async function actualizarProducto(
  id: string,
  datos: DatosActualizarProducto,
) {
  // Copia explícita de los campos permitidos: sólo se incluyen los que
  // vienen definidos, para no sobrescribir con `undefined`.
  const cambios: Partial<NewProduct> = {};
  if (datos.name !== undefined) cambios.name = datos.name;
  if (datos.tagline !== undefined) cambios.tagline = datos.tagline;
  if (datos.description !== undefined) cambios.description = datos.description;
  if (datos.category !== undefined) cambios.category = datos.category;
  // Se comprueba contra `undefined` y no con un `if` a secas para poder
  // distinguir «no se envió el campo» de «se envió null para borrarlo».
  if (datos.subcategory !== undefined) cambios.subcategory = datos.subcategory;
  if (datos.priceCents !== undefined) cambios.priceCents = datos.priceCents;
  if (datos.stock !== undefined) cambios.stock = datos.stock;
  if (datos.image !== undefined) cambios.image = datos.image;
  if (datos.featured !== undefined) cambios.featured = datos.featured;
  if (datos.specs !== undefined) cambios.specs = datos.specs;

  const [actualizado] = await db
    .update(products)
    .set(cambios)
    .where(eq(products.id, id))
    .returning();

  if (!actualizado) throw noEncontrado("El instrumento");

  registro.info("productos", "Producto actualizado", {
    slug: actualizado.slug,
    campos: Object.keys(cambios),
  });
  return actualizado;
}

/**
 * Elimina un producto (sólo administradores).
 *
 * @throws ErrorApp 404 si no existe.
 * @throws ErrorApp 409 si aparece en algún pedido (integridad histórica).
 */
export async function eliminarProducto(id: string) {
  // Comprobamos que exista antes de borrar, para poder devolver 404
  // en lugar de un "ok" silencioso que confundiría al administrador.
  const [existente] = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (!existente) throw noEncontrado("El instrumento");

  await db.delete(products).where(eq(products.id, id));

  registro.info("productos", "Producto eliminado", { id, nombre: existente.name });
  return { eliminado: true, nombre: existente.name };
}

/**
 * Estadísticas del panel de administración.
 * Las cinco consultas se lanzan EN PARALELO: tardan lo que la más
 * lenta, no la suma de todas.
 */
export async function obtenerEstadisticas() {
  const { orders, users } = await import("@/db/schema"); // Import diferido.

  const [
    [filaProductos],
    [filaPedidos],
    [filaUsuarios],
    [filaIngresos],
    pedidosRecientes,
  ] = await Promise.all([
    // Total de productos.
    db.select({ valor: sql<number>`count(*)::int` }).from(products),
    // Total de pedidos.
    db.select({ valor: sql<number>`count(*)::int` }).from(orders),
    // Total de cuentas.
    db.select({ valor: sql<number>`count(*)::int` }).from(users),
    // Ingresos: suma de los pedidos no cancelados.
    db
      .select({
        valor: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int`,
      })
      .from(orders)
      .where(ne(orders.status, "cancelado")),
    // Los cinco pedidos más recientes.
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(5),
  ]);

  return {
    totalProducts: filaProductos.valor,
    totalOrders: filaPedidos.valor,
    totalCustomers: filaUsuarios.valor,
    revenueCents: filaIngresos.valor,
    recentOrders: pedidosRecientes,
  };
}
