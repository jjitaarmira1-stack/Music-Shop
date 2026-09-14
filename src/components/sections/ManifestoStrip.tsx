import Marquee from "@/components/bits/Marquee";
import { BUSINESS } from "@/lib/business";

export default function ManifestoStrip() {
  return (
    <section className="border-y border-line bg-coal/60 py-8 md:py-10">
      <Marquee duration={36}>
        {BUSINESS.manifestoWords.map((word, i) => (
          <span key={word} className="flex items-center">
            <span
              className={
                "mx-6 whitespace-nowrap font-display text-4xl tracking-tight md:mx-10 md:text-6xl " +
                (i % 2 === 0 ? "text-cream/90" : "italic text-ember/80")
              }
            >
              {word}
            </span>
            <span className="text-2xl text-brass md:text-3xl">✦</span>
          </span>
        ))}
      </Marquee>
    </section>
  );
}
