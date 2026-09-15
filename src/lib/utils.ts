export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatPrice(cents: number) {
  return eur.format(cents / 100);
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

// ─── Categorías ──────────────────────────────────────────────────
//
// La clasificación vive ahora en `src/lib/taxonomia.ts`, que también
// describe las subcategorías. Aquí sólo se reexporta con los nombres
// que ya usaban los componentes, para no tener que tocarlos todos.

export {
  CATEGORIAS_CON_TODOS as CATEGORIES,
  ETIQUETA_CATEGORIA as CATEGORY_LABEL,
  ETIQUETA_SUBCATEGORIA as SUBCATEGORY_LABEL,
  obtenerSubcategorias,
} from "@/lib/taxonomia";

export type CategoryId = string;
