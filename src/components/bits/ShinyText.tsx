import { cn } from "@/lib/utils";

/** Texto con barrido de luz continuo (estilo ShinyText de reactbits). */
export default function ShinyText({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return <span className={cn("text-shimmer", className)}>{children}</span>;
}
