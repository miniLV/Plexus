import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, type Locale, localeFromLanguages, normalizeLocale } from "./i18n";

export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const saved = normalizeLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  if (saved) return saved;

  const headerStore = await headers();
  return localeFromLanguages(headerStore.get("accept-language") ?? undefined);
}
