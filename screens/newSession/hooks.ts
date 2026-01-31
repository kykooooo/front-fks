import { useEffect } from "react";
import { Alert } from "react-native";
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
        setAvailableEquipment(eq.length ? eq : []);
        if (eq.length) setSelectedEquipment(eq);
      } catch (e) {
        if (!cancelled) {
          console.warn("Failed to load AI context", e);
          Alert.alert("Contexte IA", "Impossible de charger ton contexte. Réessaie.");
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
  setSelectedEquipment: React.Dispatch<React.SetStateAction<string[]>>
) {
  useEffect(() => {
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

    setSelectedEquipment((prev) => {
      const filtered = prev.filter((id) => allowed.includes(id));
      if (filtered.length > 0) return filtered;
      return allowed.length > 0 ? [allowed[0]] : [];
    });
  }, [environment, availableEquipment, catalog, setSelectedEquipment]);
}
