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

export const CATEGORIES = [
  { id: "todos", label: "Todos" },
  { id: "cuerdas", label: "Cuerdas" },
  { id: "teclas", label: "Teclas" },
  { id: "percusion", label: "Percusión" },
  { id: "viento", label: "Viento" },
  { id: "estudio", label: "Estudio" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label]),
);
