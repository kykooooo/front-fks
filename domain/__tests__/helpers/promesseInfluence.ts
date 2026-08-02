// domain/__tests__/helpers/promesseInfluence.ts
//
// DÉTECTEUR DE PROMESSE D'INFLUENCE.
//
// Sert aux tests du chantier « directive » : tant que le moteur de génération ne
// lit pas la directive, AUCUN texte affiché ne doit dire ou suggérer qu'elle
// agit sur une séance.
//
// ─── LA MÉTHODE, ET POURQUOI CELLE-CI ───────────────────────────────────────
// Une liste figée de phrases interdites se contourne en reformulant : il suffit
// d'écrire « FKS s'appuie dessus » au lieu de « FKS en tient compte » pour
// passer au travers. On ne cherche donc pas des PHRASES, on cherche une
// STRUCTURE de sens :
//
//   (un verbe d'effet) appliqué à (un objet d'entraînement)
//   ex. « influence » + « séances », « adaptée » + « séance », « appliquée » +
//       « aux séances », « en tient compte » + « pour tes séances ».
//
// et on ne la déclare fautive que si le verbe n'est pas NIÉ. Les phrases
// honnêtes du produit disent précisément cette structure, mais niée : « n'est
// pas encore appliquée aux séances », « ne modifie pas les séances ». Les
// laisser passer par une liste blanche de chaînes aurait ramené le problème
// qu'on veut éviter ; on détecte donc la négation, elle aussi structurellement.
//
// La négation est cherchée DANS UNE FENÊTRE autour du verbe, pas n'importe où
// dans la phrase — et ce détail a une histoire : la phrase retirée « FKS en
// tient compte pour tes séances, sans jamais passer devant les règles de
// sécurité » contient « jamais » et « sans ». Une recherche à l'échelle de la
// phrase l'aurait donc déclarée innocente, alors que la négation portait sur
// une TOUTE AUTRE proposition. Une promesse suivie d'une réserve reste une
// promesse.
//
// ─── CE QUE ÇA N'ATTRAPE PAS (dit franchement) ──────────────────────────────
//  1. une métaphore sans verbe d'effet listé : « ta séance suit la consigne du
//     coach » n'utilise aucun mot de la famille — le test ne la verra pas ;
//  2. une promesse répartie sur DEUX phrases dont chacune est innocente ;
//  3. un texte affiché en dur dans un écran ET jamais exporté : c'est pour ça
//     que les tests d'écran balaient le RENDU en plus des constantes, et que
//     les textes sensibles ont été sortis dans domain/clubDirective.ts ;
//  4. une image (capture, illustration) porteuse de la promesse.
//
// Ce détecteur ferme les familles de formulations connues et TOUTE constante
// nouvellement exportée, automatiquement. Il ne remplace pas la relecture.

/** Verbes / tournures qui affirment un effet. */
const VERBES_EFFET = [
  "influenc", // influence, influencer, influencera
  "tient compte",
  "tenu compte",
  "prend en compte",
  "prise en compte",
  "pris en compte",
  "appliqu", // appliquée, appliquer, application
  "adapt", // adapte, adaptée, adaptation
  "ajust",
  "modifi",
  "personnalis",
  "s'appuie",
  "se base",
  "construite avec",
  "construite a partir",
  "construite à partir",
  "utilise pour",
  "utilisée pour",
  "guide",
  "oriente",
  "pilote",
];

/** Objets sur lesquels un effet serait une promesse (le terrain sportif). */
const OBJETS_ENTRAINEMENT = [
  "séance",
  "seance",
  "entraînement",
  "entrainement",
  "prépa",
  "prepa",
  "programme",
  "exercice",
];

/**
 * Marqueurs de négation : la structure est présente, mais niée.
 *
 * Des EXPRESSIONS À FRONTIÈRE DE MOT, et pas de simples sous-chaînes : « ne »
 * cherché en sous-chaîne se trouve dans « prochaiNE séance », ce qui blanchirait
 * « ta prochaine séance sera adaptée ». Piège rencontré pour de vrai en écrivant
 * ce fichier.
 */
const NEGATIONS: RegExp[] = [
  /\bne\b/,
  /\bn'/,
  /\bpas\b/,
  /\bjamais\b/,
  /\baucun/,
  /\bsans\b/,
  /\bni\b/,
  /en preparation/,
];

/**
 * Largeur de la fenêtre (en caractères) cherchée AVANT le verbe d'effet, et
 * APRÈS lui pour la seconde moitié d'un « ne ... pas ». Assez large pour couvrir
 * « n'est pas encore appliquée », assez étroite pour qu'une négation portant sur
 * une autre proposition ne blanchisse pas la promesse.
 */
const FENETRE_AVANT = 40;
/**
 * Volontairement ÉTROITE : juste de quoi attraper la seconde moitié d'un
 * « ne ... pas » collé au verbe (« ne modifie pas »). Plus large, elle avalerait
 * la réserve d'une phrase comme « ... pour tes séances, sans jamais passer
 * devant les règles de sécurité » et blanchirait la promesse qui la précède.
 */
const FENETRE_APRES = 8;

/** Comparaison insensible aux accents et à la casse (U+0300..U+036F = accents). */
const sansAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export type DetectionPromesse = {
  texte: string;
  verbe: string;
  objet: string;
};

/**
 * Renvoie les promesses détectées dans un texte. Vide = rien à signaler.
 *
 * Une occurrence n'est retenue que si le verbe d'effet et l'objet
 * d'entraînement apparaissent dans la MÊME phrase (découpage sur `.`, `;`, `!`,
 * `?`) et que le verbe lui-même n'est pas nié dans sa fenêtre immédiate.
 */
export function promessesDInfluence(texte: string): DetectionPromesse[] {
  const out: DetectionPromesse[] = [];
  for (const phrase of texte.split(/[.;!?\n]/)) {
    const p = sansAccents(phrase);
    if (!p.trim()) continue;
    for (const verbe of VERBES_EFFET) {
      const idx = p.indexOf(sansAccents(verbe));
      if (idx < 0) continue;
      const avant = p.slice(Math.max(0, idx - FENETRE_AVANT), idx);
      const apres = p.slice(idx, idx + verbe.length + FENETRE_APRES);
      const nie = NEGATIONS.some((n) => n.test(avant) || n.test(apres));
      if (nie) continue;
      for (const objet of OBJETS_ENTRAINEMENT) {
        if (p.includes(sansAccents(objet))) {
          out.push({ texte: phrase.trim(), verbe, objet });
        }
      }
    }
  }
  return out;
}

/** Collecte récursive de toutes les chaînes portées par une valeur exportée. */
export function chainesDe(valeur: unknown, vues = new Set<unknown>()): string[] {
  if (typeof valeur === "string") return [valeur];
  if (!valeur || typeof valeur !== "object" || vues.has(valeur)) return [];
  vues.add(valeur);
  return Object.values(valeur as Record<string, unknown>).flatMap((v) => chainesDe(v, vues));
}
