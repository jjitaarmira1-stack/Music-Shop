"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StarBorderProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  innerClassName?: string;
}

/**
 * Botón con borde cósmico: un haz de luz ámbar orbita el perímetro
 * (estilo StarBorder de reactbits) sobre un núcleo de tinta.
 */
export default function StarBorder({
  children,
  className,
  innerClassName,
  ...props
}: StarBorderProps) {
  return (
    <button
      className={cn(
        "group/star relative rounded-full p-px transition-transform duration-300 will-change-transform hover:scale-[1.03] active:scale-95",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="star-border absolute inset-0 rounded-full opacity-70 transition-opacity duration-300 group-hover/star:opacity-100"
      />
      <span
        className={cn(
          "relative z-10 flex items-center justify-center gap-2 rounded-full bg-ink/95 px-7 py-3.5 text-sm font-medium tracking-wide text-cream transition-colors duration-300 group-hover/star:bg-coal",
          innerClassName,
        )}
      >
        {children}
      </span>
    </button>
  );
}
