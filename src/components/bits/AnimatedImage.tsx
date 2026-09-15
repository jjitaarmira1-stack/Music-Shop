"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Fotografía animada: parallax vertical ligado al scroll + zoom orgánico
 * al pasar el ratón. Es el ingrediente base de las "fotos en movimiento".
 */
export default function AnimatedImage({
  src,
  alt,
  className,
  imgClassName,
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority = false,
  parallax = 28,
  hoverZoom = 1.07,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  sizes?: string;
  priority?: boolean;
  parallax?: number;
  hoverZoom?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const rawY = useTransform(scrollYProgress, [0, 1], [parallax, -parallax]);
  const y = useSpring(rawY, { stiffness: 90, damping: 22, mass: 0.6 });

  // ── NO SE REESCRIBE LA RUTA DE LA IMAGEN ──────────────────────
  // Aquí antes se cambiaba "/img/products/…" por "/media/products/…"
  // dando por hecho que el segundo servía también las imágenes del
  // catálogo. No es así, y por eso daban 404:
  //
  //   /img/products/…   → archivos de `public/img/products`, que trae
  //                       el proyecto y sirve Next como estáticos.
  //   /media/products/… → SÓLO las que sube el administrador, que
  //                       viven en `var/uploads` fuera de `public`.
  //
  // Son dos orígenes distintos. La ruta que llega ya es la correcta
  // (la base de datos y /api/uploads guardan cada una con su prefijo),
  // así que se usa tal cual.

  return (
    <motion.div
      ref={ref}
      className={cn("group/img relative overflow-hidden", className)}
      whileHover="hover"
      initial="rest"
      animate="rest"
    >
      <motion.div style={{ y }} className="absolute inset-[-8%]">
        <motion.div
          className="relative h-full w-full"
          variants={{ rest: { scale: 1 }, hover: { scale: hoverZoom } }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            priority={priority}
            className={cn("object-cover", imgClassName)}
          />
        </motion.div>
      </motion.div>
      {/* velo que se retira al hover */}
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-ink/25"
        variants={{ rest: { opacity: 0.35 }, hover: { opacity: 0 } }}
        transition={{ duration: 0.7 }}
      />
    </motion.div>
  );
}
