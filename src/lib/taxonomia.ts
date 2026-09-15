// ═══════════════════════════════════════════════════════════════
//  TAXONOMÍA DEL CATÁLOGO · categorías y subcategorías
//
//  Este archivo es la ÚNICA FUENTE DE VERDAD de la clasificación.
//  Lo consumen a la vez:
//    · el filtro del catálogo (navegador),
//    · el formulario del panel de administración,
//    · los esquemas de validación de Zod,
//    · la restricción CHECK de PostgreSQL.
//
//  Si mañana hay que añadir «ukeleles» dentro de Cuerdas, se toca
//  AQUÍ y sólo aquí: el resto se entera solo. Esa es la razón de que
//  exista el archivo en lugar de repetir las listas en cinco sitios.
//
//  Se importa desde componentes de cliente y de servidor, así que NO
//  puede llevar "server-only" ni depender de Node.
// ═══════════════════════════════════════════════════════════════

/** Una subcategoría: la hoja del árbol. */
export interface Subcategoria {
  /** Identificador estable. Va en la base de datos y en la URL. */
  readonly id: string;
  /** Texto que ve el visitante. */
  readonly label: string;
}

/** Una categoría principal con sus subcategorías. */
export interface Categoria {
  readonly id: string;
  readonly label: string;
  readonly subcategorias: readonly Subcategoria[];
}

// ─── El árbol completo ───────────────────────────────────────────
//
// Nota sobre los identificadores: van SIN tildes ni eñes y en
// minúsculas. Viajan en la URL (?subcategory=percusion-acustica) y en
// la base de datos, donde los acentos causan problemas de codificación
// y de comparación. Las tildes viven en `label`, que es lo que se lee.
export const CATEGORIAS: readonly Categoria[] = [
  {
    id: "cuerdas",
    label: "Cuerdas",
    subcategorias: [
      { id: "guitarras-electricas", label: "Guitarras eléctricas" },
      { id: "guitarras-acusticas", label: "Guitarras acústicas" },
      { id: "bajos", label: "Bajos" },
      { id: "violines", label: "Violines y violas" },
      { id: "violonchelos", label: "Violonchelos y contrabajos" },
      { id: "arpas-otros", label: "Arpas y otros" },
    ],
  },
  {
    id: "teclas",
    label: "Teclas",
    subcategorias: [
      { id: "pianos-digitales", label: "Pianos digitales" },
      { id: "sintetizadores", label: "Sintetizadores" },
      { id: "organos", label: "Órganos" },
      { id: "controladores-midi", label: "Controladores MIDI" },
    ],
  },
  {
    id: "percusion",
    label: "Percusión",
    subcategorias: [
      { id: "baterias-acusticas", label: "Baterías acústicas" },
      { id: "baterias-electronicas", label: "Baterías electrónicas" },
      { id: "platillos", label: "Platillos" },
      { id: "percusion-manual", label: "Percusión manual" },
    ],
  },
  {
    id: "viento",
    label: "Viento",
    subcategorias: [
      { id: "madera", label: "Viento madera" },
      { id: "metal", label: "Viento metal" },
      { id: "armonicas", label: "Armónicas y otros" },
    ],
  },
  {
    id: "estudio",
    label: "Estudio",
    subcategorias: [
      { id: "microfonos", label: "Micrófonos" },
      { id: "monitores", label: "Monitores y auriculares" },
      { id: "interfaces", label: "Interfaces de audio" },
      { id: "accesorios", label: "Accesorios" },
    ],
  },
] as const;

// ─── Listas derivadas ────────────────────────────────────────────
// Se calculan a partir del árbol para que nunca puedan desincronizarse.

/** Identificadores de las categorías principales. */
export const IDS_CATEGORIAS = CATEGORIAS.map((c) => c.id);

/** Identificadores de TODAS las subcategorías, de todas las categorías. */
export const IDS_SUBCATEGORIAS = CATEGORIAS.flatMap((c) =>
  c.subcategorias.map((s) => s.id),
);

/**
 * Categorías tal y como las espera el filtro del catálogo, con la
 * opción «Todos» al principio.
 *
 * Mantiene la forma `{ id, label }` que ya usaba el componente para no
 * tener que reescribirlo.
 */
export const CATEGORIAS_CON_TODOS = [
  { id: "todos", label: "Todos" },
  ...CATEGORIAS.map((c) => ({ id: c.id, label: c.label })),
] as const;

/** Diccionario id → etiqueta de las categorías. */
export const ETIQUETA_CATEGORIA: Record<string, string> = Object.fromEntries(
  CATEGORIAS.map((c) => [c.id, c.label]),
);

/** Diccionario id → etiqueta de las subcategorías. */
export const ETIQUETA_SUBCATEGORIA: Record<string, string> =
  Object.fromEntries(
    CATEGORIAS.flatMap((c) => c.subcategorias.map((s) => [s.id, s.label])),
  );

// ─── Funciones de consulta ───────────────────────────────────────

/**
 * Devuelve las subcategorías de una categoría.
 *
 * @param idCategoria Identificador de la categoría, o "todos".
 * @returns Lista de subcategorías. Vacía si se pide "todos" o si la
 *   categoría no existe (nunca lanza: simplifica el uso en el JSX).
 */
export function obtenerSubcategorias(
  idCategoria: string | undefined,
): readonly Subcategoria[] {
  if (!idCategoria || idCategoria === "todos") return [];
  return CATEGORIAS.find((c) => c.id === idCategoria)?.subcategorias ?? [];
}

/**
 * Comprueba que una subcategoría pertenece REALMENTE a su categoría.
 *
 * Es la comprobación clave de todo el archivo. Sin ella se podría
 * guardar un producto con categoría «viento» y subcategoría «bajos»:
 * un dato incoherente que luego no aparece en ningún filtro y que
 * resulta muy difícil de rastrear.
 *
 * @param idCategoria    Categoría principal.
 * @param idSubcategoria Subcategoría a comprobar. Puede omitirse.
 * @returns `true` si la pareja es válida o si no se indicó
 *   subcategoría (es un campo opcional).
 */
export function esSubcategoriaValida(
  idCategoria: string,
  idSubcategoria: string | null | undefined,
): boolean {
  // Sin subcategoría no hay nada que validar: el campo es opcional.
  if (!idSubcategoria) return true;

  const categoria = CATEGORIAS.find((c) => c.id === idCategoria);
  if (!categoria) return false;

  return categoria.subcategorias.some((s) => s.id === idSubcategoria);
}

/**
 * Busca a qué categoría pertenece una subcategoría.
 *
 * Útil para construir migas de pan («Cuerdas › Bajos») partiendo sólo
 * de la subcategoría.
 */
export function categoriaDeSubcategoria(
  idSubcategoria: string,
): Categoria | undefined {
  return CATEGORIAS.find((c) =>
    c.subcategorias.some((s) => s.id === idSubcategoria),
  );
}
