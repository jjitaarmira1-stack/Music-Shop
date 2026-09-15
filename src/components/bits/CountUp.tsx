"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, animate } from "framer-motion";

/**
 * Contador animado al entrar en pantalla (estilo CountUp de reactbits).
 *
 * La cuenta ascendente se ejecuta SIEMPRE, sin consultar la preferencia
 * "reducir movimiento" del sistema. Es una decisión expresa del
 * propietario: la web debe verse igual en todos los equipos.
 */
export default function CountUp({
  to,
  suffix = "",
  prefix = "",
  duration = 1.8,
  className,
}: {
  to: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}) {
  // Referencia al elemento, para saber cuándo entra en pantalla.
  const ref = useRef<HTMLSpanElement>(null);

  // `once: true` = la cuenta se hace una sola vez, no cada vez que se
  // vuelve a pasar por encima. El margen negativo la dispara un poco
  // antes de que el número asome del todo.
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });

  // Valor que se muestra: arranca en 0 y sube hasta `to`.
  const [value, setValue] = useState(0);

  useEffect(() => {
    // Todavía no se ve: no se gasta animación en algo invisible.
    if (!inView) return;

    // Animación de 0 hasta el valor final con una curva suave.
    const controls = animate(0, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      // En cada fotograma se redondea: los decimales no aportan nada
      // en cifras como «años de garantía» o «instrumentos vendidos».
      onUpdate: (v) => setValue(Math.round(v)),
    });

    // Si el componente desaparece a media cuenta, se detiene: evita
    // actualizar el estado de un componente ya desmontado.
    return () => controls.stop();
  }, [inView, to, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {/* `toLocaleString("es-ES")` pone el separador de miles español. */}
      {value.toLocaleString("es-ES")}
      {suffix}
    </span>
  );
}
