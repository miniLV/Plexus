export type Locale = "en" | "zh";

export const LOCALE_COOKIE = "plexus-locale";
export const LOCALE_STORAGE_KEY = "plexus.locale";

export function normalizeLocale(value?: string | null): Locale | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === "zh" || normalized.startsWith("zh-")) return "zh";
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  return null;
}

export function localeFromLanguages(languages: readonly string[] | string | undefined): Locale {
  const values = Array.isArray(languages)
    ? languages.map((value, index) => ({ value, q: 1, index }))
    : typeof languages === "string"
      ? languages.split(",").map((part, index) => {
          const [value = "", ...params] = part.trim().split(";");
          const qParam = params.find((param) => param.trim().startsWith("q="));
          const q = qParam ? Number(qParam.trim().slice(2)) : 1;
          return { value, q: Number.isFinite(q) ? q : 1, index };
        })
      : [];

  const supported = values
    .map((entry) => ({ ...entry, locale: normalizeLocale(entry.value) }))
    .filter((entry): entry is typeof entry & { locale: Locale } => entry.locale !== null)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  return supported[0]?.locale ?? "en";
}

export function localeName(locale: Locale): string {
  return locale === "zh" ? "中文" : "English";
}
