import type { DesktopNotificationPermissionStatus } from "./ipc";
import type { NotificationPreferences } from "./desktop-state";
import { SettingsGroup, SettingsRow } from "./settings-utils";
import { useT } from "./i18n";

interface SettingsNotificationsSectionProps {
  readonly notificationPreferences: NotificationPreferences;
  readonly notificationPermissionStatus: DesktopNotificationPermissionStatus;
  readonly notificationPermissionPending: boolean;
  readonly onSetNotificationPreferences: (preferences: Partial<NotificationPreferences>) => void;
  readonly onRequestNotificationPermission: () => void;
  readonly onOpenSystemNotificationSettings: () => void;
}

export function SettingsNotificationsSection({
  notificationPreferences,
  notificationPermissionStatus,
  notificationPermissionPending,
  onSetNotificationPreferences,
  onRequestNotificationPermission,
  onOpenSystemNotificationSettings,
}: SettingsNotificationsSectionProps) {
  const t = useT();
  const statusLabel = labelForPermissionStatus(notificationPermissionStatus, t);
  const statusDescription = descriptionForPermissionStatus(notificationPermissionStatus, t);
  const showAskMacOs = notificationPermissionStatus === "default";
  const showOpenSystemSettings = notificationPermissionStatus === "denied";
  const showRecoveryActions = showAskMacOs || showOpenSystemSettings;

  return (
    <>
      <SettingsGroup title={t("settings.notifications.system")} description={t("settings.notifications.systemDescription")}>
        <SettingsRow title={t("settings.notifications.macAccess")} description={statusDescription}>
          <span className="settings-row__value">{statusLabel}</span>
        </SettingsRow>
        {showRecoveryActions ? (
          <SettingsRow
            title={t("settings.notifications.turnOn")}
            description={showAskMacOs ? t("settings.notifications.askNowDescription") : t("settings.notifications.deniedDescription")}
          >
            <div className="settings-row__actions">
              {showAskMacOs ? (
                <button
                  className="button button--secondary"
                  disabled={notificationPermissionPending}
                  type="button"
                  onClick={onRequestNotificationPermission}
                >
                  {t("settings.notifications.askMacOs")}
                </button>
              ) : null}
              {showOpenSystemSettings ? (
                <button
                  className="button button--secondary"
                  disabled={notificationPermissionPending}
                  type="button"
                  onClick={onOpenSystemNotificationSettings}
                >
                  {t("settings.notifications.openSystemSettings")}
                </button>
              ) : null}
            </div>
          </SettingsRow>
        ) : null}
      </SettingsGroup>

      <SettingsGroup title={t("settings.notifications.inAppAlerts")} description={t("settings.notifications.inAppAlertsDescription")}>
        <SettingsRow title={t("settings.notifications.backgroundCompletion")} description={t("settings.notifications.backgroundCompletionDescription")}>
          <input
            aria-label={t("settings.notifications.backgroundCompletion")}
            checked={notificationPreferences.backgroundCompletion}
            type="checkbox"
            onChange={(event) => onSetNotificationPreferences({ backgroundCompletion: event.target.checked })}
          />
        </SettingsRow>
        <SettingsRow title={t("settings.notifications.backgroundFailures")} description={t("settings.notifications.backgroundFailuresDescription")}>
          <input
            aria-label={t("settings.notifications.backgroundFailures")}
            checked={notificationPreferences.backgroundFailure}
            type="checkbox"
            onChange={(event) => onSetNotificationPreferences({ backgroundFailure: event.target.checked })}
          />
        </SettingsRow>
        <SettingsRow title={t("settings.notifications.needsInput")} description={t("settings.notifications.needsInputDescription")}>
          <input
            aria-label={t("settings.notifications.needsInput")}
            checked={notificationPreferences.attentionNeeded}
            type="checkbox"
            onChange={(event) => onSetNotificationPreferences({ attentionNeeded: event.target.checked })}
          />
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}

function labelForPermissionStatus(
  status: DesktopNotificationPermissionStatus,
  t: (key: import("./i18n").MessageKey) => string,
): string {
  switch (status) {
    case "granted":
      return t("settings.notifications.statusEnabled");
    case "denied":
      return t("settings.notifications.statusTurnedOff");
    case "default":
      return t("settings.notifications.statusNotEnabled");
    case "unsupported":
      return t("settings.notifications.statusUnavailable");
    default:
      return t("settings.notifications.statusChecking");
  }
}

function descriptionForPermissionStatus(
  status: DesktopNotificationPermissionStatus,
  t: (key: import("./i18n").MessageKey) => string,
): string {
  switch (status) {
    case "granted":
      return t("settings.notifications.descGranted");
    case "denied":
      return t("settings.notifications.descDenied");
    case "default":
      return t("settings.notifications.descDefault");
    case "unsupported":
      return t("settings.notifications.descUnsupported");
    default:
      return t("settings.notifications.descChecking");
  }
}
