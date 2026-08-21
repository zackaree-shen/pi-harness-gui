/**
 * Full-UI skins (a.k.a. "big-change" themes) — not just color palettes but
 * component-level restyling (title bars, buttons, inputs, backgrounds), like
 * dsh-skins. A skin layers CSS-variable overrides AND custom CSS over the base
 * design system. "official" is the stock appearance.
 */
export type ThemeSkinId = "official" | "xp-luna";

export interface ThemeSkin {
  readonly id: ThemeSkinId;
  readonly name: string;
  readonly description: string;
  readonly swatches: readonly string[];
  /** CSS variables applied on top of the active theme preset. */
  readonly tokens: Readonly<Record<string, string>>;
  /** Component-level overrides injected via a <style data-theme-skin> tag. */
  readonly css?: string;
}

export const THEME_SKINS: readonly ThemeSkin[] = [
  {
    id: "official",
    name: "Official",
    description: "Stock pi-gui appearance",
    swatches: ["#6a55f2", "#1e1e2e", "#f1ecf8"],
    tokens: {},
  },
  {
    id: "xp-luna",
    name: "Windows XP (Luna)",
    description: "Luna blue title bars · green Start button · Bliss sky desktop",
    swatches: ["#2158d0", "#4c9c2e", "#7db7e8"],
    tokens: {
      "--accent": "#2158d0",
      "--text": "#1a2a3a",
      "--text-strong": "#0a1f33",
      "--muted": "#3f5a73",
      "--muted-strong": "#2c4560",
      "--muted-soft": "#4f6880",
      "--line": "#9db8d6",
      "--line-strong": "#7a9cc0",
      "--error": "#b0002a",
      "--button-primary-bg": "#4c9c2e",
      "--button-primary-border": "#3a7d22",
      "--button-primary-ink": "#ffffff",
      "--button-primary-hover-bg": "#5cb23b",
    },
    css: `
/* ── Windows XP (Luna) full-UI skin ───────────────────────────── */

/* Bliss sky desktop: blue sky gradient with a green hill band. */
body {
  background: linear-gradient(
    to bottom,
    #3b82e0 0%,
    #6fb3e8 38%,
    #8ecb8c 62%,
    #5fa85f 74%,
    #4e9a4e 100%
  ) fixed;
}

/* Title bar — Luna blue gradient with a glossy sheen. */
.topbar {
  background: linear-gradient(180deg, #3f77d9 0%, #2158d0 45%, #0e3aa8 100%);
  border-bottom: 1px solid #0a2a6e;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
}
.topbar__workspace,
.topbar__session,
.topbar__separator {
  color: #ffffff;
  text-shadow: 0 1px 1px rgba(0, 20, 60, 0.6);
}

/* Sidebar — Luna light blue. */
.sidebar {
  background: linear-gradient(180deg, #b8d6f4 0%, #9dc1ea 50%, #8db6e4 100%);
  border-right: 1px solid #6f94c4;
}
.sidebar__nav-item,
.sidebar__new {
  color: #10335f;
}
.sidebar__nav-item:hover {
  background: rgba(255, 255, 255, 0.35);
}

/* Buttons — XP glossy 3D style. */
.button {
  border-radius: 6px;
  border: 1px solid #7a9cc0;
  background: linear-gradient(180deg, #fdfdfe 0%, #e8f1fa 45%, #c8def2 100%);
  color: #0a1f33;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 1px 2px rgba(0, 30, 70, 0.25);
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7);
}
.button:hover:not(:disabled) {
  background: linear-gradient(180deg, #f3f9ff 0%, #d9ecfb 45%, #b4d5f2 100%);
  border-color: #3f77d9;
}
.button--primary {
  border-color: #2e6d18;
  background: linear-gradient(180deg, #7cc454 0%, #4c9c2e 45%, #2f7a1c 100%);
  color: #ffffff;
  text-shadow: 0 1px 1px rgba(0, 40, 10, 0.7);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 1px 2px rgba(0, 40, 10, 0.35);
}
.button--primary:hover:not(:disabled) {
  background: linear-gradient(180deg, #8ed267 0%, #5cb23b 45%, #3a8a24 100%);
  border-color: #245c12;
}
.button--ghost {
  background: linear-gradient(180deg, #fdfdfe 0%, #e8f1fa 45%, #c8def2 100%);
  border-color: #7a9cc0;
}

/* Inputs — white with XP blue border. */
.composer__editor textarea,
.settings-search,
.settings-text-input,
.settings-select,
.thread-search-bar__input,
.skill-search,
.skills-search {
  border: 1px solid #7a9cc0;
  border-radius: 5px;
  background: #ffffff;
  color: #0a1f33;
}
.composer__editor textarea:focus,
.settings-search:focus,
.settings-text-input:focus,
.thread-search-bar__input:focus {
  border-color: #2158d0;
  box-shadow: 0 0 4px rgba(33, 88, 208, 0.5);
}

/* Settings pills */
.settings-pill {
  border: 1px solid #7a9cc0;
  border-radius: 6px;
  background: linear-gradient(180deg, #fdfdfe 0%, #e8f1fa 45%, #c8def2 100%);
  color: #0a1f33;
}
.settings-pill--active {
  background: linear-gradient(180deg, #7cc454 0%, #4c9c2e 45%, #2f7a1c 100%);
  border-color: #2e6d18;
  color: #ffffff;
}
`,
  },
];

export function isThemeSkinId(value: string): value is ThemeSkinId {
  return THEME_SKINS.some((skin) => skin.id === value);
}

export function getThemeSkin(id: ThemeSkinId): ThemeSkin {
  return THEME_SKINS.find((skin) => skin.id === id) ?? THEME_SKINS[0]!;
}

/**
 * Apply a skin to the document root: layer its CSS-variable overrides on top
 * of the theme preset, and inject (or remove) its component-level <style>.
 */
export function applyThemeSkinToRoot(root: HTMLElement, skinId: ThemeSkinId): void {
  root.querySelector("[data-theme-skin]")?.remove();
  const skin = getThemeSkin(skinId);
  for (const [key, value] of Object.entries(skin.tokens)) {
    root.style.setProperty(key, value);
  }
  if (skin.css) {
    const style = document.createElement("style");
    style.dataset.themeSkin = "true";
    style.textContent = skin.css;
    root.appendChild(style);
  }
}
