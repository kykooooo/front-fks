import { useEffect } from "react";
import { showToast } from "../../utils/toast";
import { buildAIPromptContext } from "../../services/aiContext";
import type { EnvironmentSelection } from "./types";
import type React from "react";

type AiContextState = {
  aiContext: any | null;
  contextLoading: boolean;
  setAiContext: (ctx: any | null) => void;
  setContextLoading: (b: boolean) => void;
  setAvailableEquipment: (eq: string[]) => void;
  setSelectedEquipment: React.Dispatch<React.SetStateAction<string[]>>;
};

const BALL_EQUIPMENT_IDS = new Set([
  "medball",
  "medicine_ball",
  "swiss_ball",
  "home_swiss_ball",
  "fitball",
]);

const filterOutBallEquipment = (list: string[]) =>
  list.filter((id) => !BALL_EQUIPMENT_IDS.has(String(id)));

export function useAiContextLoader(
  storeHydrated: boolean,
  setters: AiContextState,
  enabled: boolean = true
) {
  const {
    aiContext,
    setAiContext,
    contextLoading,
    setContextLoading,
    setAvailableEquipment,
    setSelectedEquipment,
  } = setters;

  useEffect(() => {
    if (!enabled || !storeHydrated || aiContext) return;
    let cancelled = false;
    (async () => {
      try {
        setContextLoading(true);
        const ctx = await buildAIPromptContext();
        if (cancelled) return;
        setAiContext(ctx);

        const eq = Array.isArray(ctx.equipment_available) ? ctx.equipment_available : [];
        const safeEq = filterOutBallEquipment(eq);
        setAvailableEquipment(safeEq.length ? safeEq : []);
        if (safeEq.length) setSelectedEquipment(safeEq);
      } catch (e) {
        if (!cancelled) {
          console.warn("Failed to load AI context", e);
          showToast({ type: "error", title: "Contexte IA", message: "Impossible de charger ton contexte. Réessaie." });
        }
      } finally {
        if (!cancelled) setContextLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    storeHydrated,
    aiContext,
    setAiContext,
    setContextLoading,
    setAvailableEquipment,
    setSelectedEquipment,
  ]);

  return { aiContext, contextLoading };
}

export function useEnvironmentEquipment(
  environment: EnvironmentSelection,
  availableEquipment: string[],
  catalog: { id: string; source: string }[],
  setSelectedEquipment: React.Dispatch<React.SetStateAction<string[]>>,
  options?: { gymMachinesEnabled?: boolean; pitchSmallGearEnabled?: boolean }
) {
  useEffect(() => {
    const autoEquipment: string[] = [];
    if (options?.gymMachinesEnabled && environment.includes("gym")) {
      autoEquipment.push("gym_full", "bodyweight");
    }
  if (options?.pitchSmallGearEnabled && environment.includes("pitch")) {
    autoEquipment.push(
      "field",
      "cones",
      "flat_markers",
      "speed_ladder",
      "mini_hurdles",
      "minibands",
      "long_bands",
      "bodyweight"
    );
  }
  if (autoEquipment.length > 0) {
    const homeExtras = environment.includes("home")
      ? ["home_small", "backpack", "water_bottles", "chair"]
      : [];
      setSelectedEquipment(
        filterOutBallEquipment(Array.from(new Set([...autoEquipment, ...homeExtras])))
      );
      return;
    }
    const homeExtras = environment.includes("home")
      ? ["home_small", "backpack", "water_bottles", "chair"]
      : [];
    const allowed = catalog
      .filter((item) => {
        if (availableEquipment.length > 0 && !availableEquipment.includes(item.id)) return false;
        if (environment.length === 0) return true;
        if (item.source === "both") return true;
        return environment.includes(item.source as any);
      })
      .map((item) => item.id)
      .concat(homeExtras);
    const allowedSafe = filterOutBallEquipment(allowed);

    setSelectedEquipment((prev) => {
      const filtered = filterOutBallEquipment(prev).filter((id) => allowedSafe.includes(id));
      if (filtered.length > 0) return filtered;
      return allowedSafe.length > 0 ? [allowedSafe[0]] : [];
    });
  }, [
    environment,
    availableEquipment,
    catalog,
    setSelectedEquipment,
    options?.gymMachinesEnabled,
    options?.pitchSmallGearEnabled,
  ]);
}
