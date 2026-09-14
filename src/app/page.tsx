import { getProducts } from "@/lib/data";
import Hero from "@/components/sections/Hero";
import ManifestoStrip from "@/components/sections/ManifestoStrip";
import Featured from "@/components/sections/Featured";
import Catalog from "@/components/sections/Catalog";
import Craft from "@/components/sections/Craft";
import CtaFinal from "@/components/sections/CtaFinal";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [all, featured] = await Promise.all([
    getProducts(),
    getProducts({ featured: true }),
  ]);

  return (
    <>
      <Hero />
      <ManifestoStrip />
      <Featured products={featured} />
      <Catalog initialProducts={all} />
      <Craft />
      <CtaFinal />
    </>
  );
}
