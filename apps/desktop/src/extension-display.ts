import type { RuntimeExtensionRecord } from "@pi-gui/session-driver/runtime-types";
import type { MessageKey } from "./i18n/messages/zh-CN";

export function extensionSourceSummary(
  extension: RuntimeExtensionRecord,
  t: (key: MessageKey) => string,
): string {
  return `${extensionScopeLabel(extension, t)} · ${extension.sourceInfo.origin}`;
}

export function extensionScopeLabel(
  extension: RuntimeExtensionRecord,
  t: (key: MessageKey) => string,
): string {
  if (extension.sourceInfo.source === "builtin" && extension.sourceInfo.origin === "top-level") {
    return t("extensions.builtIn");
  }
  return extension.sourceInfo.scope;
}
