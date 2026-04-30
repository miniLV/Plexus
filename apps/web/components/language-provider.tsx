"use client";

import {
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  type Locale,
  localeFromLanguages,
  normalizeLocale,
} from "@/lib/i18n";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function browserLocale(): Locale {
  if (typeof window === "undefined") return "en";
  return localeFromLanguages(window.navigator.languages ?? window.navigator.language);
}

function persistLocale(locale: Locale) {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

export function LanguageProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const saved = normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
    const next = saved ?? initialLocale ?? browserLocale();
    if (next !== locale) {
      setLocaleState(next);
      router.refresh();
    }
    persistLocale(next);
  }, [initialLocale, locale, router]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale(next) {
        setLocaleState(next);
        persistLocale(next);
        router.refresh();
      },
      toggleLocale() {
        const next = locale === "zh" ? "en" : "zh";
        setLocaleState(next);
        persistLocale(next);
        router.refresh();
      },
    }),
    [locale, router],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage must be used inside LanguageProvider");
  return value;
}
