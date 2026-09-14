"use client";

import { useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/db/schema";
import { useCart } from "@/lib/cart";
import StarBorder from "@/components/bits/StarBorder";
import Magnetic from "@/components/bits/Magnetic";

export default function AddToCart({ product }: { product: Product }) {
  const [qty, setQty] = useState(1);
  const { add } = useCart();

  const addToCart = () => {
    add(product, qty);
    toast.success(`${product.name} ×${qty} en tu selección`);
  };

  if (product.stock === 0) {
    return (
      <p className="rounded-2xl border border-line bg-panel/60 px-6 py-4 text-center text-sm text-fog">
        Esta pieza ya encontró dueño. Escríbenos y te avisaremos de la próxima.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-4 rounded-full border border-line px-4 py-3">
        <button
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          aria-label="Menos unidades"
          className="text-fog transition-colors hover:text-cream"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="min-w-6 text-center font-mono text-sm">{qty}</span>
        <button
          onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
          aria-label="Más unidades"
          className="text-fog transition-colors hover:text-cream"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <Magnetic>
        <StarBorder onClick={addToCart} innerClassName="px-8 py-4">
          <ShoppingBag className="h-4 w-4" />
          Añadir a la selección
        </StarBorder>
      </Magnetic>
    </div>
  );
}
