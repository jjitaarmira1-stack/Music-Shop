import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uuid,
  index,
  check,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm"; // Para escribir las restricciones CHECK.

// ═══════════════════════════════════════════════════════════════
//  ESQUEMA DE LA BASE DE DATOS
//  Mejoras sobre la versión original:
//   · Restricciones CHECK: la base rechaza por sí misma los datos
//     imposibles (precio o stock negativos, roles inventados…).
//     Antes el oversell dejó el stock en −3 y nadie lo impidió.
//   · Índices pensados para las consultas que hace la aplicación.
//   · Índice único en el correo, insensible a mayúsculas.
// ═══════════════════════════════════════════════════════════════

// ─── Tipos de dominio ───────────────────────────────────────────

/** Roles disponibles. Añadir uno nuevo obliga a tocar también el CHECK. */
export type Role = "admin" | "customer";

/** Estados por los que puede pasar un pedido. */
export type OrderStatus =
  | "pendiente"
  | "pagado"
  | "enviado"
  | "entregado"
  | "cancelado";

/**
 * Línea de un pedido.
 * Se guarda como copia (JSON) a propósito: si mañana cambia el precio
 * del producto o se retira del catálogo, el pedido histórico debe
 * seguir mostrando lo que se compró y a qué precio.
 */
export interface OrderItem {
  productId: string; // Identificador del producto en el momento de la compra.
  slug: string; // Enlace permanente hacia la ficha.
  name: string; // Nombre en el momento de la compra.
  priceCents: number; // Precio unitario congelado.
  qty: number; // Unidades compradas.
  image: string; // Imagen en el momento de la compra.
}

/** Par etiqueta/valor de la ficha técnica de un instrumento. */
export interface ProductSpec {
  label: string;
  value: string;
}

// ─── Tabla: usuarios ────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    // Identificador aleatorio. Se usa UUID en lugar de un entero
    // autoincremental para no revelar cuántos usuarios hay ni permitir
    // recorrer las cuentas probando 1, 2, 3… (enumeración).
    id: uuid("id").defaultRandom().primaryKey(),

    // Nombre visible del usuario.
    name: text("name").notNull(),

    // Correo: identificador de acceso, único en toda la tabla.
    email: text("email").notNull().unique(),

    // Hash de la contraseña (Argon2id). NUNCA la contraseña en claro.
    passwordHash: text("password_hash").notNull(),

    // Rol que determina los permisos.
    role: text("role").$type<Role>().notNull().default("customer"),

    // Fecha de alta, con zona horaria para evitar ambigüedades.
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Índice ÚNICO en minúsculas: impide registrar "Ana@x.com" y
    // "ana@x.com" como dos cuentas distintas. La aplicación ya
    // normaliza, pero la base debe garantizarlo igualmente.
    uniqueIndex("users_email_lower_idx").on(sql`lower(${t.email})`),

    // La base sólo acepta los roles que existen de verdad.
    check("users_role_check", sql`${t.role} in ('admin', 'customer')`),

    // Comprobación mínima de que el correo tiene forma de correo.
    check("users_email_format_check", sql`${t.email} like '%_@_%.__%'`),
  ],
);

// ─── Tabla: productos ───────────────────────────────────────────

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Identificador legible para las URLs (/producto/noir-vantage).
    slug: text("slug").notNull().unique(),

    name: text("name").notNull(), // Nombre comercial.
    tagline: text("tagline").notNull(), // Frase corta de la tarjeta.
    description: text("description").notNull(), // Texto largo de la ficha.
    category: text("category").notNull(), // Categoría del catálogo.

    // Subcategoría dentro de la categoría (p. ej. "bajos" en "cuerdas").
    // Es OPCIONAL a propósito: los productos que ya existían no tienen
    // ninguna asignada, y obligar a rellenarla habría roto el catálogo
    // actual. Los nuevos sí pueden clasificarse con más detalle.
    subcategory: text("subcategory"),

    // Precio en CÉNTIMOS (entero). Guardar dinero en decimales de coma
    // flotante provoca errores de redondeo: 0.1 + 0.2 no es 0.3.
    priceCents: integer("price_cents").notNull(),

    // Unidades disponibles.
    stock: integer("stock").notNull().default(0),

    image: text("image").notNull(), // Ruta de la fotografía.
    featured: boolean("featured").notNull().default(false), // Destacado en portada.

    // Ficha técnica en JSON: es una lista de longitud variable que sólo
    // se consulta junto al producto, así que no merece tabla propia.
    specs: jsonb("specs").$type<ProductSpec[]>().notNull().default([]),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Índice para filtrar por categoría (lo hace el catálogo).
    index("products_category_idx").on(t.category),

    // Índice COMPUESTO para el filtro de dos niveles.
    // El orden importa: (categoría, subcategoría) sirve tanto para
    // filtrar sólo por categoría como por las dos a la vez. Al revés
    // no funcionaría para el primer caso.
    index("products_cat_subcat_idx").on(t.category, t.subcategory),

    // Índice PARCIAL: sólo indexa las filas destacadas, que son pocas.
    // Ocupa mucho menos que un índice completo sobre un booleano.
    index("products_featured_idx")
      .on(t.featured)
      .where(sql`${t.featured} = true`),

    // Índice compuesto que coincide con el ORDEN de la consulta del
    // catálogo (destacados primero, luego por nombre): permite a
    // PostgreSQL devolver los datos ya ordenados, sin paso extra.
    index("products_orden_idx").on(sql`${t.featured} desc`, t.name),

    // El precio nunca puede ser negativo.
    check("products_price_check", sql`${t.priceCents} >= 0`),

    // EL STOCK NUNCA PUEDE SER NEGATIVO.
    // Esta es la red de seguridad definitiva contra la venta por encima
    // del inventario: aunque un fallo futuro en la aplicación intentara
    // dejarlo en −3 (como ocurría), PostgreSQL abortaría la transacción.
    check("products_stock_check", sql`${t.stock} >= 0`),

    // Sólo se admiten las categorías que existen en el catálogo.
    check(
      "products_category_check",
      sql`${t.category} in ('cuerdas', 'teclas', 'percusion', 'viento', 'estudio')`,
    ),

    // La subcategoría debe pertenecer a SU categoría.
    //
    // Sin esta comprobación se podría guardar un producto de categoría
    // "viento" con subcategoría "bajos": un dato incoherente que no
    // aparecería en ningún filtro y sería muy difícil de rastrear.
    //
    // La aplicación ya lo valida con `esSubcategoriaValida()`, pero
    // esto es la red de seguridad: si algún día se escribe en la tabla
    // desde un script o desde la consola, la regla se sigue cumpliendo.
    //
    // `is null` primero, porque el campo es opcional.
    check(
      "products_subcategory_check",
      sql`${t.subcategory} is null or (
        (${t.category} = 'cuerdas' and ${t.subcategory} in (
          'guitarras-electricas', 'guitarras-acusticas', 'bajos',
          'violines', 'violonchelos', 'arpas-otros'))
        or (${t.category} = 'teclas' and ${t.subcategory} in (
          'pianos-digitales', 'sintetizadores', 'organos', 'controladores-midi'))
        or (${t.category} = 'percusion' and ${t.subcategory} in (
          'baterias-acusticas', 'baterias-electronicas', 'platillos', 'percusion-manual'))
        or (${t.category} = 'viento' and ${t.subcategory} in (
          'madera', 'metal', 'armonicas'))
        or (${t.category} = 'estudio' and ${t.subcategory} in (
          'microfonos', 'monitores', 'interfaces', 'accesorios'))
      )`,
    ),
  ],
);

// ─── Tabla: pedidos ─────────────────────────────────────────────

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Código legible que se enseña al cliente (JPR-2026-A1B2C3).
    code: text("code").notNull().unique(),

    // Usuario que lo hizo. Puede ser NULL: se admiten compras de
    // invitado. `set null` conserva el pedido si se borra la cuenta
    // (el histórico contable no debe desaparecer).
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    // Datos de envío copiados en el momento de la compra.
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    address: text("address").notNull(),

    // Líneas del pedido, congeladas en JSON (ver comentario de OrderItem).
    items: jsonb("items").$type<OrderItem[]>().notNull(),

    // Importe total en céntimos. Se recalcula SIEMPRE en el servidor:
    // jamás se acepta el total que envía el navegador.
    totalCents: integer("total_cents").notNull(),

    status: text("status").$type<OrderStatus>().notNull().default("pendiente"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Índice compuesto para "mis pedidos, del más reciente al más
    // antiguo": resuelve filtro y orden con una sola pasada.
    index("orders_user_fecha_idx").on(t.userId, sql`${t.createdAt} desc`),

    // Índice para el filtro por estado del panel de administración.
    index("orders_status_idx").on(t.status),

    // Índice por fecha para el listado general del panel.
    index("orders_fecha_idx").on(sql`${t.createdAt} desc`),

    // El total nunca puede ser negativo.
    check("orders_total_check", sql`${t.totalCents} >= 0`),

    // Sólo se admiten los estados definidos.
    check(
      "orders_status_check",
      sql`${t.status} in ('pendiente', 'pagado', 'enviado', 'entregado', 'cancelado')`,
    ),
  ],
);

// ─── Tipos inferidos del esquema ────────────────────────────────
// Se derivan de las tablas: si cambia una columna, el tipo cambia solo.

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

/**
 * Producto tal y como se entrega al navegador.
 * Hoy coincide con la fila completa, pero tener el tipo aparte permite
 * dejar de exponer columnas internas en el futuro sin romper nada.
 */
export type ProductoPublico = Product;

/**
 * Usuario tal y como se entrega al navegador.
 * `Omit` garantiza, EN TIEMPO DE COMPILACIÓN, que el hash de la
 * contraseña no pueda colarse en una respuesta por descuido.
 */
export type UsuarioPublico = Omit<User, "passwordHash">;
