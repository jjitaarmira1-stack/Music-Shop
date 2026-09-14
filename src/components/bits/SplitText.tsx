"use client";

import { motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

interface SplitTextProps {
  text: string;
  className?: string;
  mode?: "chars" | "words";
  delay?: number;
  stagger?: number;
  once?: boolean;
  accentWords?: string[]; // palabras que se renderizan en serif itálica ember
}

const container = (stagger: number, delay: number): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger, delayChildren: delay },
  },
});

const child: Variants = {
  hidden: { y: "115%", rotate: 4, opacity: 0 },
  visible: {
    y: "0%",
    rotate: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 190, damping: 24 },
  },
};

/** Titulares que entran letra a letra (estilo SplitText de reactbits). */
export default function SplitText({
  text,
  className,
  mode = "words",
  delay = 0,
  stagger = 0.035,
  once = true,
  accentWords = [],
}: SplitTextProps) {
  const tokens =
    mode === "chars" ? Array.from(text) : text.split(/(\s+)/).filter(Boolean);

  return (
    <motion.span
      className={cn("inline-block", className)}
      variants={container(stagger, delay)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-12% 0px" }}
      aria-label={text}
    >
      {tokens.map((token, i) => {
        if (/^\s+$/.test(token)) return <span key={i}> </span>;
        const isAccent = accentWords.some(
          (w) => w.toLowerCase() === token.replace(/[.,:;!¿?]/g, "").toLowerCase(),
        );
        return (
          <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            <motion.span
              variants={child}
              className={cn(
                "inline-block will-change-transform",
                isAccent && "font-display italic text-ember",
              )}
            >
              {token}
            </motion.span>
          </span>
        );
      })}
    </motion.span>
  );
}
