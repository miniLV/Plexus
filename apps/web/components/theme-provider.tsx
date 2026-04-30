"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * ADR-007: theme switching via next-themes + [data-theme] attribute.
 * Default is light for the public dashboard; users can still toggle dark.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
      themes={["dark", "light"]}
    >
      {children}
    </NextThemesProvider>
  );
}
