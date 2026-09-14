import Link from "next/link";
import Aurora from "@/components/bits/Aurora";
import SplitText from "@/components/bits/SplitText";

export default function NotFound() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-5 text-center">
      <Aurora />
      <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-ember">
        Error 404 · Fuera de tono
      </p>
      <h1 className="mt-6 font-display text-[clamp(3rem,10vw,8rem)] leading-none">
        <SplitText text="Este compás" mode="chars" stagger={0.03} />
        <br />
        <SplitText
          text="no existe"
          accentWords={["existe"]}
          delay={0.3}
          className="italic"
        />
      </h1>
      <Link
        href="/"
        className="mt-12 rounded-full border border-ember/50 bg-ember/10 px-8 py-3.5 text-sm text-ember transition-all hover:bg-ember hover:text-ink"
      >
        Volver al escenario
      </Link>
    </div>
  );
}
