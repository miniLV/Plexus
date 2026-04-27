"use client";

import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * Pill-style theme toggle matching the dashboard mockup. Clicking flips
 * dark↔light. The thumb's position animates via CSS transform.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Avoid hydration mismatch — render a non-interactive ghost until mounted.
  const isLight = mounted && resolvedTheme === "light";

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      title={isLight ? "Switch to dark" : "Switch to light"}
      onClick={() => setTheme(isLight ? "dark" : "light")}
      className={cn(
        "relative h-7 w-14 rounded-full border border-plexus-border bg-plexus-surface-2",
        "transition-colors duration-plexus-normal",
        className,
      )}
    >
      <span
        className={cn(
          "absolute top-[2px] left-[2px] h-[22px] w-[22px] rounded-full bg-plexus-accent",
          "transition-transform duration-plexus-normal ease-plexus-out",
          isLight && "translate-x-7",
        )}
      />
    </button>
  );
}
