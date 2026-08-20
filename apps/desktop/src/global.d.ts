import type { PiDesktopApi } from "./ipc";
import type { AppLanguage } from "./i18n/types";

export {};

declare global {
  interface Window {
    piApp?: PiDesktopApi;
    __piInitialLanguage?: AppLanguage;
  }
}
