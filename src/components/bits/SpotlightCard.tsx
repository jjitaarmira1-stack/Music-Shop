"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Tarjeta con foco que sigue al puntero (estilo SpotlightCard de reactbits):
 * un radial ámbar baña el borde y el fondo donde apunta el ratón.
 */
export default function SpotlightCard({
  children,
  className,
  intensity = 0.16,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={cn("group/spot relative overflow-hidden", className)}
      style={{ "--mx": "50%", "--my": "50%" } as React.CSSProperties}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/spot:opacity-100"
        style={{
          background: `radial-gradient(480px circle at var(--mx) var(--my), color-mix(in srgb, var(--color-ember) ${intensity *
            100}%, transparent), transparent 65%)`,
        }}
      />
      {children}
    </div>
  );
}
