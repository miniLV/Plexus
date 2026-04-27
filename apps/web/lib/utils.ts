import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Standard shadcn helper — merges Tailwind classes deterministically so
 * `cn("p-2", condition && "p-4")` resolves to whichever wins per Tailwind's
 * specificity model.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
