import type { ReactNode } from "react";
import type { RuntimeSettingsSnapshot, RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import type { I18nContextValue } from "./i18n/I18nProvider";
import { useT } from "./i18n";

export type SettingsSection = "appearance" | "general" | "providers" | "models" | "notifications";

export const THINKING_LEVELS: NonNullable<RuntimeSettingsSnapshot["defaultThinkingLevel"]>[] = [
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

export function settingsPill(active: boolean): string {
  return `settings-pill${active ? " settings-pill--active" : ""}`;
}

export function labelForThinking(
  level: NonNullable<RuntimeSettingsSnapshot["defaultThinkingLevel"]>,
  t: I18nContextValue["t"],
): string {
  switch (level) {
    case "low":
      return t("settings.models.thinkingLow");
    case "medium":
      return t("settings.models.thinkingMedium");
    case "high":
      return t("settings.models.thinkingHigh");
    case "xhigh":
      return t("settings.models.thinkingXHigh");
    default:
      return t("settings.models.thinkingMax");
  }
}

export function sectionTitle(section: SettingsSection, t: I18nContextValue["t"]): string {
  switch (section) {
    case "appearance":
      return t("settings.appearance.title");
    case "providers":
      return t("settings.providers.title");
    case "models":
      return t("settings.models.title");
    case "notifications":
      return t("settings.notifications.title");
    default:
      return t("settings.general.title");
  }
}

export function sectionDescription(
  section: SettingsSection,
  workspaceName: string,
  t: I18nContextValue["t"],
): string {
  switch (section) {
    case "appearance":
      return t("settings.appearance.description");
    case "providers":
      return t("settings.providers.description", { workspace: workspaceName });
    case "models":
      return t("settings.models.description");
    case "notifications":
      return t("settings.notifications.description");
    default:
      return t("settings.general.description");
  }
}

export function filterProviders(
  providers: readonly RuntimeSnapshot["providers"][number][],
  query: string,
): readonly RuntimeSnapshot["providers"][number][] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return providers;
  }
  return providers.filter((provider) =>
    [provider.id, provider.name, provider.authType].some((value) => value.toLowerCase().includes(normalized)),
  );
}

export function filterModels(
  models: readonly RuntimeSnapshot["models"][number][],
  query: string,
): readonly RuntimeSnapshot["models"][number][] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return models;
  }
  return models.filter((model) =>
    [model.providerId, model.providerName, model.modelId, model.label].some((value) =>
      value.toLowerCase().includes(normalized),
    ),
  );
}

/* ── Layout components ────────────────────────────────── */

export function SettingsGroup({
  title,
  description,
  children,
}: {
  readonly title?: string;
  readonly description?: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="settings-section">
      {title ? <h3 className="settings-section__title">{title}</h3> : null}
      {description ? <p className="settings-section__description">{description}</p> : null}
      <div className="settings-group">{children}</div>
    </div>
  );
}

export function SettingsRow({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children?: ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row__label">
        <div className="settings-row__title">{title}</div>
        {description ? <div className="settings-row__description">{description}</div> : null}
      </div>
      {children ? <div className="settings-row__control">{children}</div> : null}
    </div>
  );
}

export function SettingsInfoRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="settings-row">
      <div className="settings-row__label">
        <div className="settings-row__title">{label}</div>
      </div>
      <div className="settings-row__control">
        <span className="settings-row__value">{value}</span>
      </div>
    </div>
  );
}

export function ProviderRow({
  provider,
  onLoginProvider,
  onLogoutProvider,
  onConfigureApiKey,
}: {
  readonly provider: RuntimeSnapshot["providers"][number];
  readonly onLoginProvider: (providerId: string) => void;
  readonly onLogoutProvider: (providerId: string) => void;
  readonly onConfigureApiKey: (provider: RuntimeSnapshot["providers"][number]) => void;
}) {
  const t = useT();
  const action = resolveProviderAction(provider, onLoginProvider, onLogoutProvider, onConfigureApiKey, t);
  return (
    <div className="settings-row">
      <div className="settings-row__label">
        <div className="settings-row__title">{provider.name}</div>
        <div className="settings-row__description">{describeProviderStatus(provider, t)}</div>
      </div>
      {action ? (
        <div className="settings-row__control">
          <button
            className="button button--secondary"
            disabled={action.disabled}
            type="button"
            onClick={action.onClick}
          >
            {action.label}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function describeProviderStatus(provider: RuntimeSnapshot["providers"][number], t: I18nContextValue["t"]): string {
  switch (provider.authSource) {
    case "oauth":
      return t("settings.providers.statusOAuthConnected");
    case "auth_file":
      return t("settings.providers.statusApiKeyConnected");
    case "env":
      return t("settings.providers.statusEnvConnected");
    case "external":
      return provider.hasAuth ? t("settings.providers.statusExternalConnected") : t("settings.providers.configureExternally");
    default:
      if (provider.oauthSupported) {
        return t("settings.providers.statusOAuth");
      }
      if (provider.apiKeySetupSupported) {
        return t("settings.providers.statusApiKey");
      }
      return provider.authType === "api_key" ? t("settings.providers.statusApiKey") : t("settings.providers.statusBuiltIn");
  }
}

function resolveProviderAction(
  provider: RuntimeSnapshot["providers"][number],
  onLoginProvider: (providerId: string) => void,
  onLogoutProvider: (providerId: string) => void,
  onConfigureApiKey: (provider: RuntimeSnapshot["providers"][number]) => void,
  t: I18nContextValue["t"],
):
  | {
      readonly disabled: boolean;
      readonly label: string;
      readonly onClick?: () => void;
    }
  | undefined {
  if (provider.authSource === "oauth") {
    return {
      disabled: false,
      label: t("settings.providers.logout"),
      onClick: () => onLogoutProvider(provider.id),
    };
  }

  if (provider.oauthSupported && provider.authSource === "none") {
    return {
      disabled: false,
      label: t("settings.providers.login"),
      onClick: () => onLoginProvider(provider.id),
    };
  }

  if (provider.apiKeySetupSupported && (provider.authSource === "none" || provider.authSource === "auth_file")) {
    return {
      disabled: false,
      label: provider.authSource === "auth_file" ? t("settings.providers.manage") : t("settings.providers.setApiKey"),
      onClick: () => onConfigureApiKey(provider),
    };
  }

  if (provider.authSource === "env" || provider.authSource === "external") {
    return undefined;
  }

  return {
    disabled: true,
    label: t("settings.providers.configureExternally"),
  };
}
