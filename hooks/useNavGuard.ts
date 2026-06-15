import { useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";

/**
 * Garde anti-double-tap pour les CTA de navigation.
 *
 * Retourne une fonction `guardNav(action)` qui exécute `action` une seule fois
 * tant que l'écran reste en transition. La garde est réarmée automatiquement
 * quand l'écran reprend le focus (retour de la navigation / fermeture modale).
 *
 * À n'utiliser QUE pour envelopper des actions qui naviguent réellement :
 * les chemins qui ne naviguent pas (toast, alerte annulée…) ne doivent pas
 * passer par la garde, sinon elle reste armée jusqu'au prochain focus.
 *
 * Usage :
 *   const guardNav = useNavGuard();
 *   onPress={() => guardNav(() => nav.navigate("Ecran"))}
 */
export function useNavGuard() {
  const isNavigating = useRef(false);

  useFocusEffect(
    useCallback(() => {
      // Réarmement à chaque (re)focus de l'écran.
      isNavigating.current = false;
    }, [])
  );

  return useCallback((action: () => void) => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    action();
  }, []);
}
