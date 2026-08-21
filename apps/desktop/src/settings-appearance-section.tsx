import type { ThemeMode, ThemePresetId } from "./desktop-state";
import { SettingsGroup, SettingsRow } from "./settings-utils";
import { themePresets } from "./theme-presets";
import { THEME_SKINS, type ThemeSkinId } from "./theme-skins";
import { useT } from "./i18n";

interface SettingsAppearanceSectionProps {
  readonly themeMode: ThemeMode;
  readonly themePresetId: ThemePresetId;
  readonly themeSkinId: string;
  readonly onSetThemeMode: (mode: ThemeMode) => void;
  readonly onSetThemePresetId: (presetId: ThemePresetId) => void;
  readonly onSetThemeSkinId: (skinId: string) => void;
  readonly enableTransparency: boolean;
  readonly onSetEnableTransparency: (enabled: boolean) => void;
  readonly uiFontScale: number;
  readonly onSetUiFontScale: (scale: number) => void;
}

const FONT_SCALE_OPTIONS = [0.9, 0.95, 1, 1.05, 1.1, 1.15, 1.2] as const;

const THEME_OPTIONS: { mode: ThemeMode; labelKey: "themeSystem" | "themeLight" | "themeDark"; descriptionKey: string }[] = [
  { mode: "system", labelKey: "themeSystem", descriptionKey: "themeSystemDescription" },
  { mode: "light", labelKey: "themeLight", descriptionKey: "themeLightDescription" },
  { mode: "dark", labelKey: "themeDark", descriptionKey: "themeDarkDescription" },
];

export function SettingsAppearanceSection({
  themeMode,
  themePresetId,
  themeSkinId,
  onSetThemeMode,
  onSetThemePresetId,
  onSetThemeSkinId,
  enableTransparency,
  onSetEnableTransparency,
  uiFontScale,
  onSetUiFontScale,
}: SettingsAppearanceSectionProps) {
  const t = useT();
  return (
    <>
      <SettingsGroup title={t("settings.appearance.skins")} description={t("settings.appearance.skinsDescription")}>
        <div className="theme-preset-grid">
          {THEME_SKINS.map((skin) => (
            <label
              className={`theme-preset-card${themeSkinId === skin.id ? " theme-preset-card--active" : ""}`}
              key={skin.id}
            >
              <input
                checked={themeSkinId === skin.id}
                name="theme-skin"
                type="radio"
                onChange={() => onSetThemeSkinId(skin.id)}
              />
              <span className="theme-preset-card__preview" aria-hidden="true">
                {skin.swatches.map((swatch) => (
                  <span className="theme-preset-card__swatch" key={swatch} style={{ background: swatch }} />
                ))}
              </span>
              <span className="theme-preset-card__body">
                <span className="theme-preset-card__title">{t(skinTitleKey(skin.id))}</span>
                <span className="theme-preset-card__description">{t(skinDescriptionKey(skin.id))}</span>
              </span>
            </label>
          ))}
        </div>
      </SettingsGroup>
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
          title={t("settings.appearance.fontSize")}
          description={t("settings.appearance.fontSizeDescription")}
        >
          <div className="settings-pill-row" role="group" aria-label={t("settings.appearance.fontSize")}>
            {FONT_SCALE_OPTIONS.map((scale) => (
              <button
                className={`settings-pill${Math.abs(uiFontScale - scale) < 0.001 ? " settings-pill--active" : ""}`}
                key={scale}
                type="button"
                aria-pressed={Math.abs(uiFontScale - scale) < 0.001}
                onClick={() => onSetUiFontScale(scale)}
              >
                {Math.round(scale * 100)}%
              </button>
            ))}
          </div>
        </SettingsRow>
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

function skinTitleKey(id: ThemeSkinId): import("./i18n").MessageKey {
  return id === "xp-luna" ? "settings.appearance.skinXpLuna" : "settings.appearance.skinOfficial";
}

function skinDescriptionKey(id: ThemeSkinId): import("./i18n").MessageKey {
  return id === "xp-luna" ? "settings.appearance.skinXpLunaDescription" : "settings.appearance.skinOfficialDescription";
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
