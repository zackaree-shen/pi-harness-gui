import { expect, test } from "@playwright/test";
import { flattenKeys } from "../../src/i18n/catalog-utils";
import { zhCNMessages } from "../../src/i18n/messages/zh-CN";
import { enMessages } from "../../src/i18n/messages/en";

test("zh-CN and en catalogs expose the exact same message keys", () => {
  const zhKeys = new Set(flattenKeys(zhCNMessages));
  const enKeys = new Set(Object.keys(enMessages));

  const missingInEn = [...zhKeys].filter((key) => !enKeys.has(key));
  const extraInEn = [...enKeys].filter((key) => !zhKeys.has(key));

  expect(missingInEn, `keys missing from en.ts: ${missingInEn.join(", ")}`).toEqual([]);
  expect(extraInEn, `keys only in en.ts (not zh-CN): ${extraInEn.join(", ")}`).toEqual([]);
});

test("en catalog contains no untranslated placeholder leaks", () => {
  for (const [key, value] of Object.entries(enMessages)) {
    expect(value.length, `empty translation for ${key}`).toBeGreaterThan(0);
  }
});

test("interpolation placeholders match between catalogs", () => {
  for (const key of flattenKeys(zhCNMessages)) {
    const zh = getByKey(zhCNMessages, key);
    const en = enMessages[key as keyof typeof enMessages];
    const zhVars = [...zh.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const enVars = [...en.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    expect(zhVars, `placeholder mismatch for ${key}`).toEqual(enVars);
  }
});

function getByKey(messages: Record<string, unknown>, key: string): string {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    node = (node as Record<string, unknown>)[part];
  }
  return String(node);
}
