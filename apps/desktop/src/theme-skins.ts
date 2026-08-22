/**
 * Full-UI skins (a.k.a. "big-change" themes) — not just color palettes but
 * component-level restyling (title bars, buttons, inputs, backgrounds), like
 * dsh-skins. A skin layers CSS-variable overrides AND custom CSS over the base
 * design system. "official" is the stock appearance.
 */
export type ThemeSkinId = "official" | "xp-luna";

export type ResolvedTheme = "light" | "dark";

export interface ThemeSkin {
  readonly id: ThemeSkinId;
  readonly name: string;
  readonly description: string;
  readonly swatches: readonly string[];
  /** CSS variables applied on top of the active theme preset (light mode). */
  readonly tokens: Readonly<Record<string, string>>;
  /** Dark-mode token set; falls back to `tokens` when absent. */
  readonly tokensDark?: Readonly<Record<string, string>>;
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
      /* XP system font stack (Tahoma UI / SimSun CJK). */
      "--font-ui": 'Tahoma, "Microsoft Sans Serif", "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans SC", sans-serif',
      "--font-sans": 'Tahoma, "Microsoft Sans Serif", "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif',
      "--font-mono": '"Courier New", "Sarasa Mono SC", Consolas, monospace',
    },
    tokensDark: {
      "--accent": "#5a8fe6",
      "--text": "#d7e3f6",
      "--text-strong": "#f0f6ff",
      "--muted": "#9db4d0",
      "--muted-strong": "#b5c9e0",
      "--muted-soft": "#8599b8",
      "--line": "#3d5a80",
      "--line-strong": "#52739e",
      "--error": "#ff6b7d",
      "--button-primary-bg": "#4c9c2e",
      "--button-primary-border": "#3a7d22",
      "--button-primary-ink": "#ffffff",
      "--button-primary-hover-bg": "#5cb23b",
      "--font-ui": 'Tahoma, "Microsoft Sans Serif", "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", "Noto Sans SC", sans-serif',
      "--font-sans": 'Tahoma, "Microsoft Sans Serif", "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif',
      "--font-mono": '"Courier New", "Sarasa Mono SC", Consolas, monospace',
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

/* ── Icons ──────────────────────────────────────────────────────
   pi-gui icons are inline SVGs using stroke="currentColor"; the
   presentation attribute can be overridden per-chrome via CSS, so
   the skin recolors them XP-style without touching icons.tsx. */

/* Title-bar icons: light ice-blue on the Luna blue gradient. */
.topbar svg path[stroke="currentColor"],
.topbar svg rect[stroke="currentColor"],
.topbar svg circle[stroke="currentColor"] {
  stroke: #dbe7fb;
}
/* Sidebar chrome icons: XP deep blue. */
.sidebar__nav-item svg path[stroke="currentColor"],
.sidebar__nav-item svg rect[stroke="currentColor"],
.sidebar__nav-item svg circle[stroke="currentColor"],
.sidebar__footer svg path[stroke="currentColor"] {
  stroke: #0a246a;
}
/* Session list icons: XP navy. */
.session-row svg path[stroke="currentColor"],
.session-row svg rect[stroke="currentColor"],
.session-row svg circle[stroke="currentColor"] {
  stroke: #1a3c6e;
}
/* Settings pills icons: match pill ink. */
.settings-pill svg path[stroke="currentColor"] {
  stroke: #0a1f33;
}
.settings-pill--active svg path[stroke="currentColor"] {
  stroke: #ffffff;
}

/* ── Start button ───────────────────────────────────────────────
   The "New thread" button doubles as the XP Start button: green
   glossy pill with the four-color flag (XP logo) leading the text. */
.sidebar__new {
  background: linear-gradient(180deg, #7cc454 0%, #4c9c2e 45%, #2f7a1c 100%);
  border: 1px solid #2e6d18;
  color: #ffffff;
  font-weight: 700;
  text-shadow: 0 1px 1px rgba(0, 40, 10, 0.7);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 1px 2px rgba(0, 40, 10, 0.35);
}
.sidebar__new:hover:not(:disabled) {
  background: linear-gradient(180deg, #8ed267 0%, #5cb23b 45%, #3a8a24 100%);
  border-color: #245c12;
}
/* Hide the stock plus icon; the flag replaces it. */
.sidebar__new > svg {
  display: none;
}
.sidebar__new::before {
  content: "";
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect x='0.5' y='0.5' width='15' height='15' rx='1.5' fill='%23f0f6fd' stroke='%237a9cc0' stroke-width='1'/><path d='M2.5 3.2 C4 2.5 5.5 2.4 7 3 V7.4 C5.5 6.8 4 6.9 2.5 7.6 Z' fill='%23e33e2b'/><path d='M8 3 C9.5 2.4 11 2.5 12.5 3.2 V7.6 C11 6.9 9.5 6.8 8 7.4 Z' fill='%234c9c2e'/><path d='M2.5 8.4 C4 7.7 5.5 7.6 7 8.2 V12.6 C5.5 12 4 12.1 2.5 12.8 Z' fill='%232158d0'/><path d='M8 8.2 C9.5 7.6 11 7.7 12.5 8.4 V12.8 C11 12.1 9.5 12 8 12.6 Z' fill='%23f4b400'/></svg>") center / contain no-repeat;
  border-radius: 2px;
}

/* ── XP scrollbars ───────────────────────────────────────────── */
::-webkit-scrollbar {
  width: 15px;
  height: 15px;
}
::-webkit-scrollbar-track {
  background: #eaf2fc;
  border-left: 1px solid #b8d0ea;
}
::-webkit-scrollbar-thumb {
  background: linear-gradient(90deg, #cfe2f8 0%, #a8c8ec 45%, #8fb6e4 100%);
  border: 1px solid #6f94c4;
  border-radius: 2px;
}
::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(90deg, #ddebfb 0%, #bcd8f2 45%, #a3c6ea 100%);
}
::-webkit-scrollbar-corner {
  background: #eaf2fc;
}

/* ── XP form controls ────────────────────────────────────────── */
input[type="checkbox"],
input[type="radio"] {
  accent-color: #2158d0;
}
input[type="checkbox"] {
  border-radius: 2px;
}

/* ── Status dots → XP square indicators ──────────────────────── */
.session-row__status {
  border-radius: 2px;
}

/* ── Settings pills: XP control-panel flavor ──────────────────── */
.settings-pill {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 1px 2px rgba(0, 30, 70, 0.15);
}
.settings-pill--active {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 1px 2px rgba(0, 40, 10, 0.35);
}

/* ── Rounded corner reduction: XP squares things off ─────────── */
.composer__editor,
.composer__surface,
.thread-search-bar__input,
.settings-search {
  border-radius: 4px;
}

/* ── Dark mode: XP night (mirrors dsh skins' [data-ds-dark-theme]  ──
   The skin's light tokens are inline styles that beat :root.dark
   preset values, so dark variants live in tokensDark (JS) for
   variables and here for component chrome. */

/* Night sky over a dark hill. */
:root.dark body {
  background: linear-gradient(
    to bottom,
    #070c16 0%,
    #0d1830 45%,
    #10203c 60%,
    #0d2415 74%,
    #081a0e 100%
  ) fixed;
}

/* Sidebar — deep navy Luna. */
:root.dark .sidebar {
  background: linear-gradient(180deg, #1c2f55 0%, #16264a 55%, #101d3c 100%);
  border-right: 1px solid #0a1226;
}
:root.dark .sidebar__nav-item,
:root.dark .sidebar__new {
  color: #d7e3f6;
}
:root.dark .sidebar__nav-item:hover {
  background: rgba(255, 255, 255, 0.08);
}
:root.dark .sidebar svg path[stroke="currentColor"],
:root.dark .sidebar svg rect[stroke="currentColor"],
:root.dark .sidebar svg circle[stroke="currentColor"] {
  stroke: #9dc1ef;
}
:root.dark .session-row svg path[stroke="currentColor"],
:root.dark .session-row svg rect[stroke="currentColor"],
:root.dark .session-row svg circle[stroke="currentColor"] {
  stroke: #8fb4e4;
}

/* Buttons — dark XP chrome. */
:root.dark .button {
  border-color: #3d5a80;
  background: linear-gradient(180deg, #33456b 0%, #28395c 45%, #1e2d4c 100%);
  color: #e6eefc;
  text-shadow: none;
}
:root.dark .button:hover:not(:disabled) {
  background: linear-gradient(180deg, #3d527d 0%, #2a3f66 45%, #20304f 100%);
  border-color: #5a8fe6;
}
:root.dark .button--ghost {
  background: linear-gradient(180deg, #33456b 0%, #28395c 45%, #1e2d4c 100%);
  border-color: #3d5a80;
}

/* Inputs — dark fields with light text. */
:root.dark .composer__editor textarea,
:root.dark .settings-search,
:root.dark .settings-text-input,
:root.dark .settings-select,
:root.dark .thread-search-bar__input,
:root.dark .skill-search,
:root.dark .skills-search {
  border-color: #3d5a80;
  background: #0e1a30;
  color: #e6eefc;
}

/* Settings pills — dark. */
:root.dark .settings-pill {
  border-color: #3d5a80;
  background: linear-gradient(180deg, #33456b 0%, #28395c 45%, #1e2d4c 100%);
  color: #e6eefc;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
:root.dark .settings-pill svg path[stroke="currentColor"] {
  stroke: #e6eefc;
}
:root.dark .settings-pill--active {
  border-color: #2e6d18;
  background: linear-gradient(180deg, #86cf5e 0%, #4c9c2e 45%, #2f7a1c 100%);
  color: #ffffff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
}
:root.dark .settings-pill--active svg path[stroke="currentColor"] {
  stroke: #ffffff;
}

/* Scrollbars — dark XP. */
:root.dark ::-webkit-scrollbar-track {
  background: #101c34;
  border-left: 1px solid #223454;
}
:root.dark ::-webkit-scrollbar-thumb {
  background: linear-gradient(90deg, #2c4370 0%, #3d5a80 45%, #4a6a96 100%);
  border: 1px solid #52739e;
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

/** All token names any skin may set — used to fully clear on switch. */
const skinTokenNames: readonly string[] = Array.from(
  new Set(THEME_SKINS.flatMap((skin) => [...Object.keys(skin.tokens), ...Object.keys(skin.tokensDark ?? {})])),
);

/**
 * Apply a skin to the document root: layer its CSS-variable overrides on top
 * of the theme preset, and inject (or remove) its component-level <style>.
 * Like theme presets, skins carry separate light/dark token sets so text
 * contrast survives system dark mode.
 */
export function applyThemeSkinToRoot(root: HTMLElement, skinId: ThemeSkinId, resolvedTheme: ResolvedTheme = "light"): void {
  root.querySelector("[data-theme-skin]")?.remove();
  for (const tokenName of skinTokenNames) {
    root.style.removeProperty(tokenName);
  }
  const skin = getThemeSkin(skinId);
  const tokens = resolvedTheme === "dark" ? (skin.tokensDark ?? skin.tokens) : skin.tokens;
  for (const [key, value] of Object.entries(tokens)) {
    root.style.setProperty(key, value);
  }
  if (skin.css) {
    const style = document.createElement("style");
    style.dataset.themeSkin = "true";
    style.textContent = skin.css;
    root.appendChild(style);
  }
}
