"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Cinta infinita (estilo Marquee/LogoLoop de reactbits).
 * Duplica el contenido y lo desliza en bucle con CSS puro.
 */
export default function Marquee({
  children,
  duration = 32,
  repeat = 4,
  pauseOnHover = true,
  reverse = false,
  className,
}: {
  children: ReactNode;
  duration?: number;
  repeat?: number;
  pauseOnHover?: boolean;
  reverse?: boolean;
  className?: string;
}) {
  const items = Array.from({ length: repeat });
  return (
    <div
      className={cn(
        "group relative flex w-full overflow-hidden select-none",
        className,
      )}
    >
      <div
        className={cn(
          "flex w-max shrink-0 items-center animate-marquee",
          pauseOnHover && "group-hover:[animation-play-state:paused]",
        )}
        style={{
          "--duration": `${duration}s`,
          animationDuration: `${duration}s`,
          animationDirection: reverse ? "reverse" : undefined,
        } as CSSProperties}
      >
        {items.map((_, i) => (
          <div key={i} className="flex shrink-0 items-center" aria-hidden={i > 0}>
            {children}
          </div>
        ))}
        {items.map((_, i) => (
          <div key={`dup-${i}`} className="flex shrink-0 items-center" aria-hidden>
            {children}
          </div>
        ))}
      </div>
    </div>
  );
}
