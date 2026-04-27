"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * ADR-007: theme switching via next-themes + [data-theme] attribute.
 * Default is dark, user can pick light or system from /settings.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      themes={["dark", "light"]}
    >
      {children}
    </NextThemesProvider>
  );
}
