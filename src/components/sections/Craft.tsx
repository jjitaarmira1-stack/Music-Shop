import AnimatedImage from "@/components/bits/AnimatedImage";
import SplitText from "@/components/bits/SplitText";
import Reveal from "@/components/bits/Reveal";
import CountUp from "@/components/bits/CountUp";
import Aurora from "@/components/bits/Aurora";
import { BUSINESS } from "@/lib/business";

export default function Craft() {
  return (
    <section id="atelier" className="relative overflow-hidden border-t border-line">
      <Aurora className="opacity-50" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-24 md:grid-cols-2 md:px-10 md:py-36">
        <Reveal>
          <div className="relative">
            <AnimatedImage
              src="/img/atelier.jpg"
              alt="Manos de lutier tallando una guitarra en el taller"
              parallax={40}
              sizes="(max-width: 768px) 100vw, 50vw"
              className="aspect-[4/5] rounded-3xl border border-line"
            />
            <div className="glass absolute -bottom-6 -right-3 rounded-2xl px-6 py-4 md:-right-8">
              <p className="font-display text-2xl italic text-ember">
                {BUSINESS.suffix}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-fog">
                {BUSINESS.contact.city} — {BUSINESS.contact.coords}
              </p>
            </div>
          </div>
        </Reveal>

        <div>
          <Reveal>
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.4em] text-ember">
              {BUSINESS.craft.kicker}
            </p>
          </Reveal>
          <h2 className="font-display text-[clamp(2.2rem,4.5vw,4rem)] leading-[1.02]">
            <SplitText text={BUSINESS.craft.titleA} accentWords={[]} />
            <br />
            <SplitText
              text={BUSINESS.craft.titleB}
              accentWords={[...BUSINESS.craft.accentWords]}
              delay={0.15}
            />
          </h2>
          <Reveal delay={0.2}>
            <p className="mt-7 max-w-lg text-base leading-relaxed text-cream/70">
              {BUSINESS.craft.body}
            </p>
          </Reveal>

          <div className="mt-12 space-y-6 border-t border-line pt-2">
            {BUSINESS.craft.stats.map((s, i) => (
              <Reveal key={s.label} delay={0.1 * i}>
                <div className="flex items-baseline justify-between gap-6 border-b border-line pb-6">
                  <CountUp
                    to={s.value}
                    suffix={s.suffix}
                    className="font-display text-5xl text-ember"
                  />
                  <p className="max-w-[180px] text-right font-mono text-[11px] uppercase leading-relaxed tracking-[0.2em] text-fog">
                    {s.label}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
