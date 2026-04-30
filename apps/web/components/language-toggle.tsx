"use client";

import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";

export function LanguageToggle() {
  const { locale, toggleLocale } = useLanguage();
  const next = locale === "zh" ? "English" : "中文";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggleLocale}
      title={locale === "zh" ? "Switch to English" : "切换到中文"}
      className="h-9"
    >
      <Languages className="h-4 w-4" strokeWidth={1.5} />
      {next}
    </Button>
  );
}
