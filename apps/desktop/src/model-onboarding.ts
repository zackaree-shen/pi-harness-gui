import type { RuntimeSnapshot } from "@pi-gui/session-driver/runtime-types";
import { buildModelOptions } from "./composer-commands";
import type { MessageKey } from "./i18n/messages/zh-CN";
import type { TValues } from "./i18n/types";

type TranslateFn = (key: MessageKey, values?: TValues) => string;

export type ModelOnboardingSettingsSection = "models" | "providers";

export interface ModelOnboardingNotice {
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly actionSection: ModelOnboardingSettingsSection;
}

export interface ModelOnboardingState {
  readonly hasSelectableModels: boolean;
  readonly requiresModelSelection: boolean;
  readonly unselectedModelLabel: string;
  readonly emptyModelTitle: string;
  readonly emptyModelDescription: string;
  readonly notice?: ModelOnboardingNotice;
}

interface ModelSelectionInput {
  readonly provider: string | undefined;
  readonly modelId: string | undefined;
}

export function deriveModelOnboardingState(
  runtime: RuntimeSnapshot | undefined,
  currentSelection: ModelSelectionInput,
  t: TranslateFn,
): ModelOnboardingState {
  const selectableModels = buildModelOptions(runtime);
  const selectableSet = new Set(selectableModels.map((model) => `${model.providerId}:${model.modelId}`));
  const hasSelectableModels = selectableModels.length > 0;
  const connectedProviderCount = runtime?.providers.filter((provider) => provider.hasAuth).length ?? 0;
  const settingsDefault = {
    provider: runtime?.settings.defaultProvider,
    modelId: runtime?.settings.defaultModelId,
  };
  const hasDefaultModel = Boolean(settingsDefault.provider && settingsDefault.modelId);
  const defaultModelUsable = isUsableSelection(settingsDefault, selectableSet);
  const hasCurrentSelection = Boolean(currentSelection.provider && currentSelection.modelId);
  const currentSelectionUsable = isUsableSelection(currentSelection, selectableSet);

  if (!hasSelectableModels) {
    return {
      hasSelectableModels: false,
      requiresModelSelection: true,
      unselectedModelLabel: t("modelOnboarding.noModelsAvailable"),
      emptyModelTitle: t("modelOnboarding.noModelsAvailable"),
      emptyModelDescription:
        connectedProviderCount > 0
          ? t("modelOnboarding.enableModels")
          : t("modelOnboarding.connectProvider"),
      notice: connectedProviderCount > 0
        ? {
            title: t("modelOnboarding.allDisabledTitle"),
            description: t("modelOnboarding.allDisabledDesc"),
            actionLabel: t("modelOnboarding.openSettingsModels"),
            actionSection: "models",
          }
        : {
            title: t("modelOnboarding.noProviderTitle"),
            description: t("modelOnboarding.noProviderDesc"),
            actionLabel: t("modelOnboarding.openSettingsProviders"),
            actionSection: "providers",
          },
    };
  }

  if (hasCurrentSelection && !currentSelectionUsable) {
    return {
      hasSelectableModels: true,
      requiresModelSelection: true,
      unselectedModelLabel: t("modelOnboarding.pickAModel"),
      emptyModelTitle: t("modelOnboarding.noModelsAvailable"),
      emptyModelDescription: t("modelOnboarding.pickAModel"),
      notice: {
        title: t("modelOnboarding.selectedModelUnavailable"),
        description: hasDefaultModel
          ? t("modelOnboarding.selectedUnavailableDescDefault")
          : t("modelOnboarding.selectedUnavailableDescNoDefault"),
        actionLabel: t("modelOnboarding.openSettingsModels"),
        actionSection: "models",
      },
    };
  }

  if (!hasDefaultModel) {
    return {
      hasSelectableModels: true,
      requiresModelSelection: !currentSelectionUsable,
      unselectedModelLabel: t("modelOnboarding.pickAModel"),
      emptyModelTitle: t("modelOnboarding.noDefaultModelSet"),
      emptyModelDescription: t("modelOnboarding.pickAModel"),
      notice: currentSelectionUsable
        ? undefined
        : {
            title: t("modelOnboarding.noDefaultModelSet"),
            description: t("modelOnboarding.noDefaultDesc"),
            actionLabel: t("modelOnboarding.openSettingsModels"),
            actionSection: "models",
          },
    };
  }

  if (!defaultModelUsable) {
    const defaultLabel = `${settingsDefault.provider}:${settingsDefault.modelId}`;
    return {
      hasSelectableModels: true,
      requiresModelSelection: !currentSelectionUsable,
      unselectedModelLabel: t("modelOnboarding.pickAModel"),
      emptyModelTitle: t("modelOnboarding.defaultModelUnavailable"),
      emptyModelDescription: t("modelOnboarding.pickAModel"),
      notice: {
        title: t("modelOnboarding.defaultModelUnavailable"),
        description: currentSelectionUsable
          ? t("modelOnboarding.defaultUnavailableDescHasSelection", { model: defaultLabel })
          : t("modelOnboarding.defaultUnavailableDescNoSelection", { model: defaultLabel }),
        actionLabel: t("modelOnboarding.openSettingsModels"),
        actionSection: "models",
      },
    };
  }

  return {
    hasSelectableModels: true,
    requiresModelSelection: false,
    unselectedModelLabel: t("modelOnboarding.pickAModel"),
    emptyModelTitle: t("modelOnboarding.noModelsAvailable"),
    emptyModelDescription: t("modelOnboarding.pickAModel"),
  };
}

function isUsableSelection(
  selection: ModelSelectionInput,
  selectableSet: ReadonlySet<string>,
): boolean {
  return Boolean(selection.provider && selection.modelId && selectableSet.has(`${selection.provider}:${selection.modelId}`));
}
