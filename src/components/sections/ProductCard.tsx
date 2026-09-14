"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/db/schema";
import { useCart } from "@/lib/cart";
import { cn, formatPrice } from "@/lib/utils";
import TiltedCard from "@/components/bits/TiltedCard";
import SpotlightCard from "@/components/bits/SpotlightCard";
import AnimatedImage from "@/components/bits/AnimatedImage";

export default function ProductCard({
  product,
  index = 0,
  large = false,
}: {
  product: Product;
  index?: number;
  large?: boolean;
}) {
  const { add } = useCart();

  const addToCart = () => {
    add(product);
    toast.success(`${product.name} se une a tu selección`);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={{ duration: 0.8, delay: (index % 4) * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      <TiltedCard maxTilt={6} scale={1.01}>
        <SpotlightCard className="flex h-full flex-col rounded-3xl border border-line bg-panel/40">
          <Link
            href={`/producto/${product.slug}`}
            className="relative block"
            data-cursor
          >
            <AnimatedImage
              src={product.image}
              alt={product.name}
              parallax={16}
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
              className={cn(
                "rounded-t-3xl",
                large ? "aspect-[16/11]" : "aspect-[4/3]",
              )}
            />
            {product.stock <= 4 && (
              <span className="absolute left-4 top-4 rounded-full border border-ember/40 bg-ink/70 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ember backdrop-blur">
                {product.stock === 0 ? "Agotado" : `Últimas ${product.stock}`}
              </span>
            )}
            {product.featured && (
              <span className="absolute right-4 top-4 rounded-full bg-ember px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink">
                Autor
              </span>
            )}
          </Link>

          <div className="flex flex-1 flex-col gap-1 p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link href={`/producto/${product.slug}`} data-cursor>
                  <h3
                    className={cn(
                      "font-display leading-tight transition-colors hover:text-ember",
                      large ? "text-3xl" : "text-2xl",
                    )}
                  >
                    {product.name}
                  </h3>
                </Link>
                <p className="mt-1 text-sm text-fog">{product.tagline}</p>
              </div>
              <p
                className={cn(
                  "whitespace-nowrap font-mono text-ember",
                  large ? "text-lg" : "text-base",
                )}
              >
                {formatPrice(product.priceCents)}
              </p>
            </div>

            <div className="mt-auto flex items-center justify-between pt-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-fog">
                {product.category}
              </span>
              <motion.button
                onClick={addToCart}
                disabled={product.stock === 0}
                whileTap={{ scale: 0.9 }}
                aria-label={`Añadir ${product.name} al carrito`}
                className="group/add grid h-10 w-10 place-items-center rounded-full border border-ember/40 bg-ember/10 text-ember transition-all hover:bg-ember hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Plus className="h-4 w-4 transition-transform duration-300 group-hover/add:rotate-90" />
              </motion.button>
            </div>
          </div>
        </SpotlightCard>
      </TiltedCard>
    </motion.article>
  );
}
