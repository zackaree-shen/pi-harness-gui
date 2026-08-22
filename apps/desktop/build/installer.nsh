; electron-builder (app-builder-lib) derives the one-click per-user install
; directory from the npm package name: "@pi-gui/desktop" sanitizes to
; "@pi-guidesktop". Override APP_FILENAME with the product name so the app
; installs to %LOCALAPPDATA%\Programs\pi-gui (matching what assisted/per-machine
; installs would use). This file is included by electron-builder before the main
; NSIS template compiles, so the redefinition applies everywhere APP_FILENAME
; is expanded (install dir, portable env var, uninstall data cleanup).
!ifndef APP_FILENAME
  !error "pi-gui installer.nsh: APP_FILENAME define missing - electron-builder changed internals, review this override"
!endif

!undef APP_FILENAME
!define APP_FILENAME "pi-gui"
