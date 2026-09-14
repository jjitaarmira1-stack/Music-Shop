import type { OrderStatus } from "@/db/schema";
import { cn } from "@/lib/utils";

const STYLES: Record<OrderStatus, string> = {
  pendiente: "border-fog/40 bg-fog/10 text-fog",
  pagado: "border-ember/50 bg-ember/10 text-ember",
  enviado: "border-flare/50 bg-flare/10 text-flare",
  entregado: "border-cream/40 bg-cream/10 text-cream",
  cancelado: "border-line bg-panel text-fog/60 line-through",
};

export default function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em]",
        STYLES[status],
      )}
    >
      {status}
    </span>
  );
}
