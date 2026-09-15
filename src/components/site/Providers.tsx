"use client";

import { useEffect, type ReactNode } from "react";
import Lenis from "lenis";
import { Toaster } from "sonner";
import { CartProvider } from "@/lib/cart";
import { SessionProvider } from "@/lib/session";

/**
 * Activa el desplazamiento suave (Lenis) en toda la web.
 *
 * Se inicializa SIEMPRE, sin consultar la preferencia "reducir
 * movimiento" del sistema: es una decisión expresa del propietario
 * para que la experiencia sea idéntica en todos los equipos.
 */
function useLenis() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // Anclas suaves compatibles con Lenis
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>(
        'a[href^="/#"], a[href^="#"]',
      );
      if (!anchor) return;
      const hash = anchor.getAttribute("href")?.replace(/^\//, "");
      if (!hash) return;
      const el = document.querySelector(hash);
      if (el) {
        e.preventDefault();
        lenis.scrollTo(el as HTMLElement, { offset: -80 });
      }
    };
    document.addEventListener("click", onClick);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("click", onClick);
      lenis.destroy();
    };
    // Sin dependencias: se monta una sola vez, al cargar la web.
  }, []);
}

export default function Providers({ children }: { children: ReactNode }) {
  // Desplazamiento suave activo en todo momento.
  useLenis();
  return (
    <SessionProvider>
      <CartProvider>
        {children}
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "#1a1713",
              border: "1px solid #2b251d",
              color: "#f2ede3",
              fontFamily: "var(--font-sans)",
            },
          }}
        />
      </CartProvider>
    </SessionProvider>
  );
}
