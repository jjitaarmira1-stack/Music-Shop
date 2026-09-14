import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { getProductBySlug, getRelatedProducts } from "@/lib/data";
import { formatPrice } from "@/lib/utils";
import AnimatedImage from "@/components/bits/AnimatedImage";
import ShinyText from "@/components/bits/ShinyText";
import SplitText from "@/components/bits/SplitText";
import Reveal from "@/components/bits/Reveal";
import AddToCart from "@/components/sections/AddToCart";
import ProductCard from "@/components/sections/ProductCard";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "No encontrado" };
  return {
    title: product.name,
    description: product.tagline,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product.slug, product.category);

  return (
    <div className="relative mx-auto max-w-7xl px-5 pb-28 pt-28 md:px-10 md:pt-36">
      <Reveal>
        <Link
          href="/#catalogo"
          className="mb-10 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-fog transition-colors hover:text-ember"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al catálogo
        </Link>
      </Reveal>

      <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
        <Reveal className="lg:sticky lg:top-28 lg:self-start">
          <AnimatedImage
            src={product.image}
            alt={product.name}
            priority
            parallax={30}
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="aspect-[4/5] rounded-3xl border border-line"
          />
        </Reveal>

        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-ember">
            {product.category}
          </p>
          <h1 className="mt-4 font-display text-[clamp(2.8rem,6vw,5.5rem)] leading-[0.95]">
            <SplitText text={product.name} mode="chars" stagger={0.03} />
          </h1>
          <Reveal delay={0.1}>
            <p className="mt-3 font-display text-xl italic text-fog">
              {product.tagline}
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <p className="mt-8 font-mono text-3xl">
              <ShinyText>{formatPrice(product.priceCents)}</ShinyText>
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-fog">
              IVA incluido · Envío asegurado
            </p>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="mt-8 max-w-lg text-base leading-relaxed text-cream/75">
              {product.description}
            </p>
          </Reveal>

          <Reveal delay={0.25}>
            <div className="mt-6 flex items-center gap-2 text-sm">
              <span
                className={
                  "h-2 w-2 rounded-full " +
                  (product.stock > 0 ? "bg-ember" : "bg-line")
                }
                style={
                  product.stock > 0
                    ? { animation: "pulse-glow 2s ease-in-out infinite" }
                    : undefined
                }
              />
              <span className="text-fog">
                {product.stock > 0
                  ? `${product.stock} ${product.stock === 1 ? "pieza disponible" : "piezas disponibles"}`
                  : "Agotado temporalmente"}
              </span>
            </div>
          </Reveal>

          <Reveal delay={0.3}>
            <div className="mt-10">
              <AddToCart product={product} />
            </div>
          </Reveal>

          {product.specs.length > 0 && (
            <Reveal delay={0.35}>
              <div className="mt-12 border-t border-line">
                {product.specs.map((spec) => (
                  <div
                    key={spec.label}
                    className="flex items-baseline justify-between gap-6 border-b border-line py-4"
                  >
                    <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-fog">
                      {spec.label}
                    </span>
                    <span className="text-right text-sm text-cream">
                      {spec.value}
                    </span>
                  </div>
                ))}
              </div>
            </Reveal>
          )}

          <Reveal delay={0.4}>
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                { icon: Truck, label: "Envío mundial" },
                { icon: ShieldCheck, label: "Garantía 5 años" },
                { icon: PackageCheck, label: "Setup incluido" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-panel/40 px-4 py-3"
                >
                  <Icon className="h-4 w-4 shrink-0 text-ember" />
                  <span className="text-xs text-fog">{label}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-32">
          <h2 className="mb-10 font-display text-4xl md:text-5xl">
            <SplitText text="Sigue la frecuencia" accentWords={["frecuencia"]} />
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
