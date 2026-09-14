import { cn } from "@/lib/utils";

/**
 * Texto rodante al hover (rolling links): la palabra asciende y entra
 * su duplicado en ámbar desde abajo.
 */
export default function RollingText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "group/roll relative inline-block overflow-hidden align-middle",
        className,
      )}
    >
      <span className="block transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/roll:-translate-y-full">
        {text}
      </span>
      <span
        aria-hidden
        className="absolute inset-0 block translate-y-full text-ember transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/roll:translate-y-0"
      >
        {text}
      </span>
    </span>
  );
}
