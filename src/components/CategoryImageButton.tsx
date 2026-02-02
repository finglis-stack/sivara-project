import * as React from "react";

import { cn } from "@/lib/utils";

type Props = {
  label: string;
  imageSrc: string;
  onClick?: () => void;
  className?: string;
};

export default function CategoryImageButton({
  label,
  imageSrc,
  onClick,
  className,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative isolate h-12 w-[160px] overflow-hidden rounded-2xl",
        "border border-white/40 bg-black/20 shadow-sm",
        "transition-all duration-300",
        "hover:-translate-y-0.5 hover:shadow-lg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAFAFA]",
        className
      )}
      aria-label={label}
    >
      <div
        className={cn(
          "absolute inset-0 bg-cover bg-center",
          "transition-transform duration-700",
          "group-hover:scale-110"
        )}
        style={{ backgroundImage: `url(${imageSrc})` }}
      />

      {/* Dark overlay (petit fond plus foncé) */}
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/40 to-black/55" />

      {/* Subtle highlight */}
      <div className="absolute inset-0 ring-1 ring-white/10 transition-colors duration-300 group-hover:ring-white/20" />

      <span
        className={cn(
          "relative z-10 block",
          "text-white",
          "text-[11px] sm:text-xs",
          "font-extralight",
          "uppercase",
          "tracking-[0.28em]",
          "drop-shadow-[0_1px_10px_rgba(0,0,0,0.55)]"
        )}
      >
        {label}
      </span>

      {/* Micro shine */}
      <div className="pointer-events-none absolute -left-16 top-0 h-full w-24 rotate-12 bg-white/10 blur-xl transition-transform duration-700 group-hover:translate-x-[280px]" />
    </button>
  );
}
