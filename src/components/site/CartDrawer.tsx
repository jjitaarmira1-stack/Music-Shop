"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/utils";
import { useFocoModal } from "@/lib/accesibilidad";
import SpotlightCard from "@/components/bits/SpotlightCard";

export default function CartDrawer() {
  const { lines, isOpen, closeCart, setQty, remove, totalCents, clear } =
    useCart();

  // Gestiona el foco del panel: lo atrapa dentro mientras está abierto,
  // cierra con la tecla Escape y devuelve el foco al botón del carrito
  // al cerrarse. Antes no había nada de esto y era imposible cerrar el
  // carrito sin ratón.
  const refPanel = useFocoModal(isOpen, closeCart);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/*
            Fondo oscuro. Antes era un <div> con onClick: inalcanzable
            con el teclado. Ahora es un <button> real con etiqueta, así
            que también funciona con lector de pantalla y tabulador.
          */}
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
            aria-label="Cerrar el carrito"
            tabIndex={-1}
            className="fixed inset-0 z-[80] cursor-default bg-ink/70 backdrop-blur-sm"
          />
          {/*
            Panel del carrito.
            `role="dialog"` + `aria-modal` informan al lector de pantalla
            de que es una ventana modal; `aria-labelledby` le da su
            título leyendo la cabecera de más abajo.
          */}
          <motion.aside
            ref={refPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-carrito"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 34 }}
            className="fixed right-0 top-0 z-[90] flex h-dvh w-full max-w-md flex-col border-l border-line bg-coal"
          >
            <div className="flex items-center justify-between border-b border-line px-6 py-5">
              <h3
                id="titulo-carrito"
                className="flex items-center gap-3 font-display text-2xl"
              >
                Tu selección
                <span className="font-mono text-xs text-fog">
                  {lines.length} {lines.length === 1 ? "pieza" : "piezas"}
                </span>
              </h3>
              <button
                onClick={closeCart}
                aria-label="Cerrar carrito"
                className="grid h-10 w-10 place-items-center rounded-full border border-line text-fog transition-colors hover:border-ember/60 hover:text-ember"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {lines.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <span className="grid h-16 w-16 place-items-center rounded-full border border-line bg-panel text-fog">
                    <ShoppingBag className="h-6 w-6" />
                  </span>
                  <p className="font-display text-xl text-cream">
                    Aún no suena nada
                  </p>
                  <p className="max-w-[220px] text-sm text-fog">
                    Explora el catálogo y deja que un instrumento te elija.
                  </p>
                  <Link
                    href="/#catalogo"
                    onClick={closeCart}
                    className="mt-2 rounded-full border border-ember/50 bg-ember/10 px-6 py-2.5 text-sm text-ember transition-colors hover:bg-ember hover:text-ink"
                  >
                    Ver catálogo
                  </Link>
                </div>
              ) : (
                <ul className="space-y-4">
                  <AnimatePresence initial={false}>
                    {lines.map(({ product, qty }) => (
                      <motion.li
                        key={product.id}
                        layout
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 40 }}
                        transition={{ duration: 0.3 }}
                      >
                        <SpotlightCard className="rounded-2xl border border-line bg-panel/60 p-3">
                          <div className="flex gap-4">
                            <Link
                              href={`/producto/${product.slug}`}
                              onClick={closeCart}
                              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line"
                            >
                              <Image
                                src={product.image}
                                alt={product.name}
                                fill
                                sizes="80px"
                                className="object-cover"
                              />
                            </Link>
                            <div className="flex flex-1 flex-col justify-between py-0.5">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-display text-lg leading-tight">
                                    {product.name}
                                  </p>
                                  <p className="font-mono text-xs text-fog">
                                    {formatPrice(product.priceCents)}
                                  </p>
                                </div>
                                <button
                                  onClick={() => remove(product.id)}
                                  aria-label={`Quitar ${product.name}`}
                                  className="text-fog transition-colors hover:text-ember"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 rounded-full border border-line px-2 py-1">
                                  <button
                                    onClick={() => setQty(product.id, qty - 1)}
                                    aria-label={`Quitar una unidad de ${product.name}`}
                                    className="grid h-8 w-8 place-items-center text-fog hover:text-cream"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <span className="min-w-4 text-center font-mono text-xs">
                                    {qty}
                                  </span>
                                  <button
                                    onClick={() => setQty(product.id, qty + 1)}
                                    aria-label={`Añadir una unidad de ${product.name}`}
                                    className="grid h-8 w-8 place-items-center text-fog hover:text-cream"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <p className="font-mono text-sm text-ember">
                                  {formatPrice(product.priceCents * qty)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </SpotlightCard>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {lines.length > 0 && (
              <div className="border-t border-line px-6 py-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-[0.25em] text-fog">
                    Total
                  </span>
                  <span className="font-display text-3xl text-ember">
                    {formatPrice(totalCents)}
                  </span>
                </div>
                <Link
                  href="/checkout"
                  onClick={closeCart}
                  className="group flex w-full items-center justify-center gap-2 rounded-full bg-ember py-4 text-sm font-semibold uppercase tracking-[0.2em] text-ink transition-transform hover:scale-[1.02] active:scale-95"
                >
                  Finalizar compra
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <button
                  onClick={clear}
                  className="mt-3 w-full text-center font-mono text-[10px] uppercase tracking-[0.25em] text-fog transition-colors hover:text-ember"
                >
                  Vaciar selección
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
