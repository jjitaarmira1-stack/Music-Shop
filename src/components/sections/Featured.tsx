import type { Product } from "@/db/schema";
import SplitText from "@/components/bits/SplitText";
import Reveal from "@/components/bits/Reveal";
import ProductCard from "@/components/sections/ProductCard";
import { BUSINESS } from "@/lib/business";

export default function Featured({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  // Rejilla asimétrica: la primera pieza domina el escenario.
  const spans = [
    "md:col-span-7",
    "md:col-span-5",
    "md:col-span-5",
    "md:col-span-7",
  ];

  return (
    <section id="coleccion" className="relative mx-auto max-w-7xl px-5 py-24 md:px-10 md:py-36">
      <div className="mb-14 flex flex-wrap items-end justify-between gap-6">
        <div>
          <Reveal>
            <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.4em] text-ember">
              {BUSINESS.featured.kicker}
            </p>
          </Reveal>
          <h2 className="font-display text-[clamp(2.2rem,5vw,4.5rem)] leading-none">
            <SplitText text={BUSINESS.featured.titleA} accentWords={[]} />
            <br />
            <SplitText
              text={BUSINESS.featured.titleB}
              accentWords={[BUSINESS.featured.accentWord]}
              delay={0.15}
            />
          </h2>
        </div>
        <Reveal delay={0.2} className="max-w-xs">
          <p className="text-sm leading-relaxed text-fog">
            {BUSINESS.featured.blurb}
          </p>
        </Reveal>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:gap-8">
        {products.slice(0, 4).map((product, i) => (
          <div key={product.id} className={spans[i % spans.length]}>
            <ProductCard product={product} index={i} large={i % 4 === 0 || i % 4 === 3} />
          </div>
        ))}
      </div>
    </section>
  );
}
