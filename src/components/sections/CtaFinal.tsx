"use client";

import Aurora from "@/components/bits/Aurora";
import SplitText from "@/components/bits/SplitText";
import StarBorder from "@/components/bits/StarBorder";
import Magnetic from "@/components/bits/Magnetic";
import Reveal from "@/components/bits/Reveal";
import { BUSINESS } from "@/lib/business";

export default function CtaFinal() {
  return (
    <section className="relative overflow-hidden border-t border-line py-28 md:py-40">
      <Aurora />
      <div className="relative mx-auto max-w-4xl px-5 text-center">
        <Reveal>
          <p className="mb-6 font-mono text-[11px] uppercase tracking-[0.4em] text-fog">
            {BUSINESS.cta.kicker}
          </p>
        </Reveal>
        <h2 className="font-display text-[clamp(2.6rem,7vw,6rem)] leading-[0.98]">
          <SplitText
            text={BUSINESS.cta.titleA}
            mode="chars"
            stagger={0.02}
          />
          <br />
          <SplitText
            text={BUSINESS.cta.titleB}
            accentWords={[BUSINESS.cta.accentWord]}
            delay={0.3}
            className="italic"
          />
        </h2>
        <Reveal delay={0.4}>
          <p className="mx-auto mt-8 max-w-md text-base leading-relaxed text-cream/70">
            {BUSINESS.cta.description}
          </p>
        </Reveal>
        <Reveal delay={0.55}>
          <div className="mt-12 flex justify-center">
            <Magnetic>
              <StarBorder
                onClick={() =>
                  document
                    .querySelector("#catalogo")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                innerClassName="px-10 py-4 text-base"
              >
                {BUSINESS.cta.buttonLabel}
              </StarBorder>
            </Magnetic>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
