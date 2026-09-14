import { z } from "zod"; // Librería de validación de esquemas.

// ═══════════════════════════════════════════════════════════════
//  ESQUEMAS DE VALIDACIÓN COMPARTIDOS
//  Este archivo NO importa "server-only" a propósito: los mismos
//  esquemas se usan en el servidor (obligatorio) y en el navegador
//  (comodidad, para avisar al usuario antes de enviar).
//
//  REGLA DE ORO: el navegador valida para mejorar la experiencia,
//  el servidor valida porque es lo único en lo que se puede confiar.
// ═══════════════════════════════════════════════════════════════

// ─── Piezas reutilizables ──────────────────────────────────────

/**
 * Identificador UUID.
 * Antes los `id` llegaban sin validar a la consulta SQL y provocaban
 * un error 500 de PostgreSQL; ahora se rechazan con un 422 limpio.
 */
export const esquemaUuid = z.string().uuid("Identificador no válido");

/**
 * Correo electrónico.
 * Se normaliza (minúsculas y sin espacios) ANTES de validar, para que
 * "  Ana@Correo.COM " y "ana@correo.com" sean el mismo usuario.
 */
export const esquemaEmail = z
  .string({ message: "El correo es obligatorio" })
  .trim() // Quita espacios al principio y al final.
  .toLowerCase() // Normaliza a minúsculas.
  .min(5, "El correo es demasiado corto")
  .max(254, "El correo es demasiado largo") // Límite del estándar RFC 5321.
  .email("Introduce un correo electrónico válido");

/**
 * Contraseña en el momento del REGISTRO.
 * Mínimo 10 caracteres (antes eran 6, insuficiente) y exigimos
 * mezcla de letras y números, que es la recomendación práctica del
 * NIST sin llegar a reglas absurdas que empujan a usar "Pa$$w0rd1".
 */
export const esquemaContrasenaNueva = z
  .string({ message: "La contraseña es obligatoria" })
  .min(10, "La contraseña debe tener al menos 10 caracteres")
  .max(128, "La contraseña no puede superar los 128 caracteres")
  .refine(
    (valor) => /[a-zA-Z]/.test(valor), // Debe contener alguna letra.
    "La contraseña debe incluir al menos una letra",
  )
  .refine(
    (valor) => /[0-9]/.test(valor), // Debe contener algún número.
    "La contraseña debe incluir al menos un número",
  );

/**
 * Contraseña en el momento de INICIAR SESIÓN.
 * Aquí no aplicamos reglas de complejidad: si el usuario se registró
 * cuando las reglas eran otras, debe poder entrar igualmente.
 * Sólo limitamos la longitud para evitar abusos de CPU al hashear.
 */
export const esquemaContrasenaLogin = z
  .string({ message: "La contraseña es obligatoria" })
  .min(1, "Introduce tu contraseña")
  .max(128, "Contraseña demasiado larga");

/** Nombre de una persona. */
export const esquemaNombre = z
  .string({ message: "El nombre es obligatorio" })
  .trim()
  .min(2, "El nombre debe tener al menos 2 caracteres")
  .max(80, "El nombre no puede superar los 80 caracteres");

/**
 * Categorías válidas del catálogo.
 * Antes `category` era texto libre: se podía crear un producto con una
 * categoría inexistente que luego no aparecía en ningún filtro.
 */
export const CATEGORIAS_VALIDAS = [
  "cuerdas",
  "teclas",
  "percusion",
  "viento",
  "estudio",
] as const;

/** Esquema que sólo acepta una de las categorías anteriores. */
export const esquemaCategoria = z.enum(CATEGORIAS_VALIDAS, {
  message: "Selecciona una categoría válida del catálogo",
});

/** Estados por los que puede pasar un pedido. */
export const ESTADOS_PEDIDO = [
  "pendiente",
  "pagado",
  "enviado",
  "entregado",
  "cancelado",
] as const;

/** Esquema que sólo acepta uno de los estados anteriores. */
export const esquemaEstadoPedido = z.enum(ESTADOS_PEDIDO, {
  message: "Estado de pedido no válido",
});

/** Precio en céntimos: entero, nunca negativo y con un techo razonable. */
const esquemaPrecioCentimos = z
  .number({ message: "El precio es obligatorio" })
  .int("El precio debe ser un número entero de céntimos")
  .min(0, "El precio no puede ser negativo")
  .max(100_000_000, "El precio supera el máximo permitido (1.000.000)");

/** Unidades en almacén: entero entre 0 y 100.000. */
const esquemaStock = z
  .number()
  .int("El stock debe ser un número entero")
  .min(0, "El stock no puede ser negativo")
  .max(100_000, "El stock supera el máximo permitido");

/** Ficha técnica: lista de pares etiqueta/valor, con tope de elementos. */
const esquemaEspecificaciones = z
  .array(
    z.object({
      label: z.string().trim().min(1, "La etiqueta no puede estar vacía").max(60),
      value: z.string().trim().min(1, "El valor no puede estar vacío").max(160),
    }),
  )
  .max(20, "Máximo 20 características por instrumento");

/**
 * Ruta de imagen.
 * Sólo se aceptan rutas internas conocidas. Esto evita dos cosas:
 *  · que se inyecte una URL externa (fuga de datos hacia terceros),
 *  · que se inyecte `javascript:` o `data:` (vector de XSS).
 */
const esquemaRutaImagen = z
  .string()
  .trim()
  .max(300, "Ruta de imagen demasiado larga")
  .refine(
    (valor) => /^\/(img|media)\/[A-Za-z0-9._\-/]+$/.test(valor),
    "La imagen debe ser una ruta interna válida (/img/... o /media/...)",
  );

// ─── Autenticación ─────────────────────────────────────────────

/** Datos que se envían al iniciar sesión. */
export const esquemaLogin = z.object({
  email: esquemaEmail,
  password: esquemaContrasenaLogin,
});

/** Datos que se envían al crear una cuenta. */
export const esquemaRegistro = z.object({
  name: esquemaNombre,
  email: esquemaEmail,
  password: esquemaContrasenaNueva,
});

// ─── Productos ─────────────────────────────────────────────────

/** Campos necesarios para crear un instrumento (sólo administradores). */
export const esquemaCrearProducto = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").max(120),
  tagline: z.string().trim().min(2, "El eslogan es obligatorio").max(160),
  description: z
    .string()
    .trim()
    .min(10, "La descripción debe tener al menos 10 caracteres")
    .max(4000, "La descripción es demasiado larga"),
  category: esquemaCategoria,
  priceCents: esquemaPrecioCentimos,
  // Los siguientes son opcionales y tienen valor por defecto.
  stock: esquemaStock.default(0),
  image: esquemaRutaImagen.optional(),
  featured: z.boolean().default(false),
  specs: esquemaEspecificaciones.default([]),
});

/**
 * Campos que se pueden modificar de un instrumento.
 * `.partial()` los hace todos opcionales; `.refine()` obliga a enviar
 * al menos uno, para que un PATCH vacío no se considere válido.
 *
 * Esto además cierra el *mass assignment*: aunque el cliente mande
 * `id`, `createdAt` o `slug`, Zod los descarta porque no están aquí.
 */
export const esquemaActualizarProducto = esquemaCrearProducto
  .partial()
  .refine(
    (datos) => Object.keys(datos).length > 0,
    "Debes enviar al menos un campo para actualizar",
  );

/** Parámetros de búsqueda admitidos en `GET /api/products`. */
export const esquemaFiltrosProducto = z.object({
  // "todos" es un valor especial que significa "sin filtrar".
  category: z.enum([...CATEGORIAS_VALIDAS, "todos"]).optional(),
  // Texto de búsqueda, acotado para evitar consultas desmedidas.
  q: z.string().trim().max(100, "La búsqueda es demasiado larga").optional(),
  // "1" activa el filtro de destacados.
  featured: z.enum(["0", "1"]).optional(),
  // Paginación: página actual y tamaño, con topes seguros.
  page: z.coerce.number().int().min(1).max(1000).default(1),
  perPage: z.coerce.number().int().min(1).max(60).default(24),
});

// ─── Pedidos ───────────────────────────────────────────────────

/** Una línea del carrito tal y como la envía el navegador. */
const esquemaLineaCarrito = z.object({
  // Identificador del producto: debe ser un UUID real.
  productId: esquemaUuid,
  // Cantidad: mínimo 1 y máximo 50 por línea (evita pedidos absurdos).
  qty: z
    .number()
    .int("La cantidad debe ser un número entero")
    .min(1, "La cantidad mínima es 1")
    .max(50, "Máximo 50 unidades por instrumento"),
});

/** Datos completos que se envían al confirmar un pedido. */
export const esquemaCrearPedido = z.object({
  customerName: esquemaNombre,
  // Antes se aceptaba "no-es-un-email": ahora se valida de verdad.
  customerEmail: esquemaEmail,
  address: z
    .string()
    .trim()
    .min(10, "Indica una dirección completa (calle, número, ciudad)")
    .max(500, "La dirección es demasiado larga"),
  // El carrito: entre 1 y 50 líneas distintas.
  items: z
    .array(esquemaLineaCarrito)
    .min(1, "El carrito está vacío")
    .max(50, "Demasiados instrumentos distintos en un solo pedido"),
});

/** Cambio de estado de un pedido (sólo administradores). */
export const esquemaActualizarPedido = z.object({
  status: esquemaEstadoPedido,
});

// ─── Tipos derivados ───────────────────────────────────────────
// Se infieren del esquema para que el tipo y la validación nunca
// se desincronicen: si cambia el esquema, cambia el tipo.

export type DatosLogin = z.infer<typeof esquemaLogin>;
export type DatosRegistro = z.infer<typeof esquemaRegistro>;
export type DatosCrearProducto = z.infer<typeof esquemaCrearProducto>;
export type DatosActualizarProducto = z.infer<typeof esquemaActualizarProducto>;
export type DatosCrearPedido = z.infer<typeof esquemaCrearPedido>;
export type FiltrosProducto = z.infer<typeof esquemaFiltrosProducto>;
