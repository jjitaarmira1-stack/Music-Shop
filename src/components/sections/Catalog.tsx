"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, SlidersHorizontal } from "lucide-react";
import type { Product } from "@/db/schema";
import { CATEGORIES, cn } from "@/lib/utils";
import SplitText from "@/components/bits/SplitText";
import Reveal from "@/components/bits/Reveal";
import ProductCard from "@/components/sections/ProductCard";
import { BUSINESS } from "@/lib/business";
import { peticionJson } from "@/lib/cliente-http";

export default function Catalog({
  initialProducts,
}: {
  initialProducts: Product[];
}) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [category, setCategory] = useState("todos");
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const firstRun = useRef(true);
  // Mensaje de error de la búsqueda. Antes el `catch` se tragaba
  // cualquier fallo en silencio: si la API caía, el usuario veía la
  // lista antigua y creía que no había novedades.
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const params = new URLSearchParams();
      if (category !== "todos") params.set("category", category);
      if (query.trim()) params.set("q", query.trim());
      try {
        // `peticionJson` añade tiempo máximo de espera y reintentos,
        // y propaga la señal de cancelación del debounce.
        const datos = await peticionJson<{ products: Product[] }>(
          `/api/products?${params}`,
          { signal: controller.signal, reintentos: 1 },
        );
        startTransition(() => {
          setProducts(datos.products ?? []);
          setErrorBusqueda(null);
        });
      } catch (error) {
        // Si la petición se canceló (el usuario siguió escribiendo) no
        // es un error real: se ignora sin avisar de nada.
        if (controller.signal.aborted) return;
        setErrorBusqueda(
          "No se ha podido actualizar el catálogo. Revisa tu conexión.",
        );
      }
    }, 240);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [category, query]);

  return (
    <section id="catalogo" className="relative border-t border-line bg-coal/40">
      <div className="mx-auto max-w-7xl px-5 py-24 md:px-10 md:py-36">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-8">
          <div>
            <Reveal>
              <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.4em] text-ember">
                {BUSINESS.catalog.kicker}
              </p>
            </Reveal>
            <h2 className="font-display text-[clamp(2.2rem,5vw,4.5rem)] leading-none">
              <SplitText
                text={BUSINESS.catalog.title}
                accentWords={[BUSINESS.catalog.accentWord]}
              />
            </h2>
          </div>

          <Reveal delay={0.15}>
            <label className="glass flex items-center gap-3 rounded-full px-5 py-3">
              <Search className="h-4 w-4 text-fog" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={BUSINESS.catalog.searchPlaceholder}
                className="w-44 bg-transparent text-sm text-cream outline-none placeholder:text-fog md:w-56"
              />
            </label>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div className="mb-12 flex flex-wrap items-center gap-2">
            <SlidersHorizontal className="mr-2 h-4 w-4 text-fog" />
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={cn(
                  "relative rounded-full border px-5 py-2 text-sm transition-all duration-300",
                  category === cat.id
                    ? "border-ember bg-ember text-ink"
                    : "border-line text-fog hover:border-ember/50 hover:text-cream",
                )}
              >
                {cat.label}
                {category === cat.id && (
                  <motion.span
                    layoutId="cat-glow"
                    className="absolute inset-0 -z-10 rounded-full bg-ember blur-md"
                  />
                )}
              </button>
            ))}
          </div>
        </Reveal>

        {/*
          Aviso de error de red. `role="status"` hace que el lector de
          pantalla lo anuncie sin interrumpir lo que esté leyendo.
        */}
        {errorBusqueda && (
          <div
            role="status"
            className="mb-8 rounded-2xl border border-ember/40 bg-ember/10 px-5 py-4 text-sm text-ember"
          >
            {errorBusqueda}
          </div>
        )}

        {/*
          `aria-busy` informa a las ayudas técnicas de que la lista se
          está actualizando; sin él, la atenuación visual no se percibe.
        */}
        <div
          aria-busy={isPending}
          className={cn(
            "grid grid-cols-1 gap-6 transition-opacity duration-300 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
            isPending && "opacity-40",
          )}
        >
          <AnimatePresence mode="popLayout">
            {products.map((product, i) => (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.4, delay: (i % 4) * 0.04 }}
              >
                <ProductCard product={product} index={i} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {products.length === 0 && !isPending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-3 py-24 text-center"
          >
            <p className="font-display text-3xl text-cream">Silencio absoluto</p>
            <p className="max-w-sm text-sm text-fog">
              Ningún instrumento responde a esa búsqueda. Prueba con otra
              categoría o borra el filtro.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategory("todos");
              }}
              className="mt-2 rounded-full border border-ember/50 bg-ember/10 px-6 py-2.5 text-sm text-ember transition-colors hover:bg-ember hover:text-ink"
            >
              Limpiar filtros
            </button>
          </motion.div>
        )}
      </div>
    </section>
  );
}
