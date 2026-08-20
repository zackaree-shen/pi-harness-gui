import type { ThemeMode, ThemePresetId } from "./desktop-state";
import { SettingsGroup, SettingsRow } from "./settings-utils";
import { themePresets } from "./theme-presets";
import { useT } from "./i18n";

interface SettingsAppearanceSectionProps {
  readonly themeMode: ThemeMode;
  readonly themePresetId: ThemePresetId;
  readonly onSetThemeMode: (mode: ThemeMode) => void;
  readonly onSetThemePresetId: (presetId: ThemePresetId) => void;
  readonly enableTransparency: boolean;
  readonly onSetEnableTransparency: (enabled: boolean) => void;
}

const THEME_OPTIONS: { mode: ThemeMode; labelKey: "themeSystem" | "themeLight" | "themeDark"; descriptionKey: string }[] = [
  { mode: "system", labelKey: "themeSystem", descriptionKey: "themeSystemDescription" },
  { mode: "light", labelKey: "themeLight", descriptionKey: "themeLightDescription" },
  { mode: "dark", labelKey: "themeDark", descriptionKey: "themeDarkDescription" },
];

export function SettingsAppearanceSection({
  themeMode,
  themePresetId,
  onSetThemeMode,
  onSetThemePresetId,
  enableTransparency,
  onSetEnableTransparency,
}: SettingsAppearanceSectionProps) {
  const t = useT();
  return (
    <>
      <SettingsGroup title={t("settings.appearance.themePreset")}>
        <div className="theme-preset-grid">
          {themePresets.map((preset) => (
            <label
              className={`theme-preset-card${themePresetId === preset.id ? " theme-preset-card--active" : ""}`}
              key={preset.id}
            >
              <input
                checked={themePresetId === preset.id}
                name="theme-preset"
                type="radio"
                onChange={() => onSetThemePresetId(preset.id)}
              />
              <span className="theme-preset-card__preview" aria-hidden="true">
                {preset.swatches.map((swatch) => (
                  <span
                    className="theme-preset-card__swatch"
                    key={swatch}
                    style={{ background: swatch }}
                  />
                ))}
              </span>
              <span className="theme-preset-card__body">
                <span className="theme-preset-card__title">{preset.name}</span>
                <span className="theme-preset-card__description">{preset.description}</span>
              </span>
            </label>
          ))}
        </div>
      </SettingsGroup>

      <SettingsGroup title={t("settings.appearance.theme")}>
        {THEME_OPTIONS.map((option) => (
          <SettingsRow
            key={option.mode}
            title={themeOptionTitle(option.labelKey, t)}
            description={themeOptionDescription(option.descriptionKey, t)}
          >
            <input
              checked={themeMode === option.mode}
              name="theme"
              type="radio"
              onChange={() => onSetThemeMode(option.mode)}
            />
          </SettingsRow>
        ))}
      </SettingsGroup>

      <SettingsGroup title={t("settings.appearance.visuals")}>
        <SettingsRow
          title={t("settings.appearance.windowTransparency")}
          description={t("settings.appearance.windowTransparencyDescription")}
        >
          <input
            aria-label={t("settings.appearance.windowTransparency")}
            type="checkbox"
            checked={enableTransparency}
            onChange={(event) => onSetEnableTransparency(event.currentTarget.checked)}
          />
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}

function themeOptionTitle(
  labelKey: "themeSystem" | "themeLight" | "themeDark",
  t: (key: import("./i18n").MessageKey) => string,
): string {
  switch (labelKey) {
    case "themeSystem":
      return t("settings.appearance.themeSystem");
    case "themeLight":
      return t("settings.appearance.themeLight");
    default:
      return t("settings.appearance.themeDark");
  }
}

function themeOptionDescription(
  descriptionKey: string,
  t: (key: import("./i18n").MessageKey) => string,
): string {
  switch (descriptionKey) {
    case "themeSystemDescription":
      return t("settings.appearance.themeSystemDescription");
    case "themeLightDescription":
      return t("settings.appearance.themeLightDescription");
    default:
      return t("settings.appearance.themeDarkDescription");
  }
}
