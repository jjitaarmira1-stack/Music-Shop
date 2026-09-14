"use client";

import { ChevronDown } from "lucide-react";
import Aurora from "@/components/bits/Aurora";
import AnimatedImage from "@/components/bits/AnimatedImage";
import SplitText from "@/components/bits/SplitText";
import ShinyText from "@/components/bits/ShinyText";
import StarBorder from "@/components/bits/StarBorder";
import Magnetic from "@/components/bits/Magnetic";
import CountUp from "@/components/bits/CountUp";
import { BUSINESS } from "@/lib/business";
import { motion } from "framer-motion";

const scrollTo = (id: string) =>
  document.querySelector(id)?.scrollIntoView({ behavior: "smooth" });

export default function Hero() {
  return (
    <section className="relative flex min-h-svh flex-col justify-end overflow-hidden">
      {/* Fondo: fotografía animada con parallax */}
      <div className="absolute inset-0">
        <AnimatedImage
          src="/img/hero.jpg"
          alt="Guitarra flotando en la penumbra con luz ámbar"
          sizes="100vw"
          priority
          parallax={60}
          hoverZoom={1.03}
          className="h-full w-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/70 via-transparent to-ink/40" />
      </div>
      <Aurora className="opacity-70" />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-16 pt-36 md:px-10 md:pb-24">
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="mb-6 font-mono text-[11px] uppercase tracking-[0.4em] text-fog"
        >
          <ShinyText>{BUSINESS.hero.kicker}</ShinyText>
        </motion.p>

        <h1 className="font-display text-[clamp(3rem,9vw,8rem)] leading-[0.92] tracking-tight">
          <SplitText
            text={BUSINESS.hero.titleA}
            mode="chars"
            stagger={0.028}
            delay={0.35}
            className="block"
          />
          <SplitText
            text={BUSINESS.hero.titleB}
            mode="chars"
            stagger={0.028}
            delay={0.75}
            accentWords={[BUSINESS.hero.accentWord]}
            className="block"
          />
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3, duration: 0.9 }}
          className="mt-8 max-w-md text-base leading-relaxed text-cream/70 md:text-lg"
        >
          {BUSINESS.hero.description}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.9 }}
          className="mt-10 flex flex-wrap items-center gap-4"
        >
          <Magnetic>
            <StarBorder onClick={() => scrollTo("#catalogo")}>
              {BUSINESS.hero.ctaPrimary}
            </StarBorder>
          </Magnetic>
          <Magnetic>
            <button
              onClick={() => scrollTo("#atelier")}
              className="rounded-full border border-cream/20 px-7 py-3.5 text-sm text-cream/80 backdrop-blur transition-all hover:border-ember/60 hover:text-ember"
            >
              {BUSINESS.hero.ctaSecondary}
            </button>
          </Magnetic>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.9, duration: 1 }}
          className="mt-16 grid max-w-xl grid-cols-3 gap-6 border-t border-cream/10 pt-8"
        >
          {BUSINESS.hero.stats.map((s) => (
            <div key={s.label}>
              <CountUp
                to={s.value}
                suffix={s.suffix}
                className="font-display text-3xl text-ember md:text-4xl"
              />
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-fog">
                {s.label}
              </p>
            </div>
          ))}
        </motion.div>
      </div>

      <motion.button
        onClick={() => scrollTo("#coleccion")}
        aria-label="Bajar"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.2 }}
        className="absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 text-fog transition-colors hover:text-ember md:block"
        style={{ animation: "float-slow 3s ease-in-out infinite" }}
      >
        <ChevronDown className="h-6 w-6" />
      </motion.button>
    </section>
  );
}
