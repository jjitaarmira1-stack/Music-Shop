import { cn } from "@/lib/utils";

/**
 * Fondo aurora: masas de luz ámbar/cobre derivando en la penumbra.
 * Renderizado 100% CSS (sin canvas) para máximo rendimiento.
 */
export default function Aurora({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      <div
        className="absolute -left-1/4 top-[-30%] h-[80vh] w-[80vw] rounded-full opacity-[0.16] blur-[110px]"
        style={{
          background:
            "radial-gradient(closest-side, #e8a33d, #a4682a 55%, transparent)",
          animation: "aurora-drift-1 18s ease-in-out infinite",
        }}
      />
      <div
        className="absolute right-[-20%] top-[10%] h-[70vh] w-[60vw] rounded-full opacity-[0.10] blur-[130px]"
        style={{
          background:
            "radial-gradient(closest-side, #f5c877, #7a4818 50%, transparent)",
          animation: "aurora-drift-2 24s ease-in-out infinite",
        }}
      />
      <div
        className="absolute bottom-[-35%] left-[15%] h-[60vh] w-[55vw] rounded-full opacity-[0.08] blur-[140px]"
        style={{
          background: "radial-gradient(closest-side, #e8a33d, transparent)",
          animation: "aurora-drift-1 30s ease-in-out infinite reverse",
        }}
      />
    </div>
  );
}
