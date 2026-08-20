import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { zhCNMessages, type MessageKey } from "./messages/zh-CN";
import { enMessages } from "./messages/en";
import type { AppLanguage, TValues } from "./types";

const STORAGE_KEY = "pi-gui:language";

export interface I18nContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  /** translate a message key with optional {placeholder} interpolation */
  t: (key: MessageKey, values?: TValues) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readInitialLanguage(): AppLanguage {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === "en" ? "en" : "zh-CN";
  } catch {
    return "zh-CN";
  }
}

function getByPath(messages: Record<string, unknown>, key: string): string {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    if (node == null || typeof node !== "object") {
      return key;
    }
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : key;
}

function interpolate(template: string, values?: TValues): string {
  if (values == null) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(readInitialLanguage);

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, language);
    } catch {
      // localStorage unavailable; skip persistence
    }
    document.documentElement.lang = language === "zh-CN" ? "zh-CN" : "en";
  }, [language]);

  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
  }, []);

  const t = useCallback(
    (key: MessageKey, values?: TValues): string => {
      const catalog = language === "zh-CN" ? zhCNMessages : enMessages;
      return interpolate(getByPath(catalog as unknown as Record<string, unknown>, key), values);
    },
    [language],
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx == null) {
    throw new Error("useI18n must be used within <I18nProvider>");
  }
  return ctx;
}

export function useT(): I18nContextValue["t"] {
  return useI18n().t;
}

export function useLanguage(): AppLanguage {
  return useI18n().language;
}

export function useSetLanguage(): (language: AppLanguage) => void {
  return useI18n().setLanguage;
}
