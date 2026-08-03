// hooks/coach/useCoachNowMs.ts
//
// L'HORLOGE DU COACH, LUE HORS RENDU.
//
// POURQUOI CE HOOK EXISTE.
// Le projecteur serveur est volontairement SANS HORLOGE : il ne projette que des
// faits à date absolue. Tout le relatif au présent ("il y a 3 min", "aujourd'hui")
// se calcule donc côté front. Les écrans coach le faisaient chacun à leur façon,
// et deux d'entre eux lisaient `Date.now()` DANS LE CORPS DU RENDU. Deux défauts :
//
//   1. Un composant qui lit l'heure pendant son rendu n'est plus idempotent :
//      deux rendus consécutifs, sans aucun changement de donnée, produisent deux
//      résultats différents. C'est ce que signale `react-hooks/purity`.
//   2. Défaut PRODUIT, plus grave : un rendu ne se déclenche que sur changement
//      d'état. Écran ouvert et posé sur la table, aucun rendu ne survient — et le
//      libellé "Mis à jour à l'instant" reste affiché vingt minutes plus tard.
//      L'écran ment alors exactement sur ce qu'il était censé garantir : dire de
//      QUAND datent les chiffres affichés.
//
// La correction des deux, c'est la même : l'instant courant devient un ÉTAT, lu
// hors rendu et rafraîchi à intervalle régulier. L'affichage suit l'horloge au
// lieu de suivre les hasards du cycle de rendu.
//
// L'horloge reste INJECTABLE (`options.now`), comme dans useCoachClub /
// useCoachPlayer / useCoachRoster : les tests pilotent le temps, ils ne
// l'attendent pas.

import { useEffect, useRef, useState } from "react";

/**
 * Cadence de rafraîchissement.
 *
 * 30 s : le libellé le plus fin est à la minute ("il y a 3 min"), une cadence
 * deux fois plus rapide suffit donc à ne jamais afficher une minute fausse.
 * Descendre plus bas ne rendrait rien de plus lisible et ferait rendre l'écran
 * pour rien.
 */
export const COACH_CLOCK_TICK_MS = 30_000;

export type UseCoachNowMsOptions = {
  /** Horloge injectée (tests). Par défaut, celle du téléphone du coach. */
  now?: () => number;
  /** Cadence du battement. `0` ou négatif : horloge figée (utile en test). */
  tickMs?: number;
};

/**
 * Instant courant (ms epoch), stable pendant un rendu, rafraîchi périodiquement.
 *
 * À utiliser partout où un écran coach a besoin du "maintenant" : fraîcheur des
 * données, jour courant. Jamais `Date.now()` en direct dans un corps de rendu.
 */
export function useCoachNowMs(options?: UseCoachNowMsOptions): number {
  // Horloge stabilisée par ref, réécrite dans un effet et jamais pendant le
  // rendu (même motif que les autres hooks coach) : changer d'horloge en cours
  // de route ne doit ni relancer le battement, ni invalider les mémos en aval.
  const nowRef = useRef<() => number>(options?.now ?? Date.now);
  useEffect(() => {
    nowRef.current = options?.now ?? Date.now;
  });

  const tickMs = options?.tickMs ?? COACH_CLOCK_TICK_MS;

  // Initialiseur PARESSEUX : l'horloge est lue une seule fois, au montage, et
  // pas à chaque rendu — c'est ce qui rend le rendu lui-même pur.
  const [nowMs, setNowMs] = useState<number>(() => (options?.now ?? Date.now)());

  useEffect(() => {
    if (tickMs <= 0) return undefined;
    const id = setInterval(() => setNowMs(nowRef.current()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);

  return nowMs;
}
