import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "./icons";
import { useT, type MessageKey } from "./i18n";

export type PermissionMode = "yolo" | "ask" | "read-only" | "workspace";

const MODE_OPTIONS: readonly { readonly mode: PermissionMode; readonly labelKey: MessageKey }[] = [
  { mode: "yolo", labelKey: "permission.modeYolo" },
  { mode: "ask", labelKey: "permission.modeAsk" },
  { mode: "read-only", labelKey: "permission.modeReadOnly" },
  { mode: "workspace", labelKey: "permission.modeWorkspace" },
];

/**
 * Permission-mode pill for the pi-permission-system extension. Reads the
 * current mode from the extension config and lets the user switch modes
 * (yolo / ask / read-only / workspace). The extension picks the change up on
 * the next session reload.
 */
export function PermissionModeBadge({ disabled }: { readonly disabled?: boolean }) {
  const t = useT();
  const [mode, setMode] = useState<PermissionMode>("ask");
  const [open, setOpen] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const api = window.piApp;
    if (!api?.getPermissionMode) {
      return;
    }
    let active = true;
    void api.getPermissionMode().then((m) => {
      if (active && isPermissionMode(m)) {
        setMode(m);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const label = (m: PermissionMode) =>
    t(MODE_OPTIONS.find((o) => o.mode === m)?.labelKey ?? ("permission.modeAsk" as const));

  const select = (next: PermissionMode) => {
    setOpen(false);
    if (next === mode) {
      return;
    }
    const api = window.piApp;
    if (!api?.setPermissionMode) {
      return;
    }
    void api.setPermissionMode(next).then(async () => {
      setMode(next);
      // Reload the session so the permission extension picks the new policy up
      // immediately — no session restart needed.
      if (api.reloadSession) {
        await api.reloadSession().catch(() => undefined);
      }
      setSavedNotice(t("permission.applyHint"));
      window.setTimeout(() => setSavedNotice(null), 4000);
    });
  };

  return (
    <span className="permission-mode" data-testid="permission-mode">
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="permission-mode__toggle"
        data-testid="permission-mode-toggle"
        disabled={disabled}
        type="button"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="permission-mode__label">{label(mode)}</span>
        <span className="permission-mode__chevron" aria-hidden="true">
          {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </span>
      </button>
      {savedNotice ? (
        <span className="permission-mode__notice" role="status">
          {savedNotice}
        </span>
      ) : null}
      {open ? (
        <div className="permission-mode__menu" data-testid="permission-mode-menu" ref={menuRef} role="menu">
          {MODE_OPTIONS.map((option) => (
            <button
              className={`permission-mode__item${option.mode === mode ? " permission-mode__item--active" : ""}`}
              key={option.mode}
              role="menuitemradio"
              type="button"
              aria-checked={option.mode === mode}
              onClick={() => select(option.mode)}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}

function isPermissionMode(value: string): value is PermissionMode {
  return value === "yolo" || value === "ask" || value === "read-only" || value === "workspace";
}
