// services/setupDraft.ts
//
// LE BROUILLON DU QUESTIONNAIRE INITIAL — local, chiffré, lié à UN compte.
//
// ─── POURQUOI ───────────────────────────────────────────────────────────────
// Fermer l'app avant « Terminer » perdait les quatre étapes (P1-05 de l'audit
// d'inscription). Le brouillon conserve les réponses ET l'étape, sans écrire le
// moindre profil partiel à distance : Firestore ne voit un profil que complet.
//
// ─── OÙ ET COMMENT ─────────────────────────────────────────────────────────
//  - Stockage : `services/encryptedStorage` (AsyncStorage chiffré, clé maître en
//    SecureStore) — le mécanisme déjà utilisé pour les ressentis de santé de la
//    file hors-ligne. Le brouillon peut porter une gêne déclarée (zone +
//    gravité) : elle ne reste donc pas en clair sur le disque.
//  - Clé : `fks_setup_draft_{uid}`. L'uid est AUSSI écrit dans la valeur et
//    revérifié à la lecture : un brouillon ne se charge que pour son compte.
//  - Contenu : une LISTE FERMÉE de réponses du questionnaire. Ni email, ni mot
//    de passe, ni jeton — ils n'entrent jamais dans ce module. Le consentement
//    parental n'est PAS conservé : c'est un acte daté, il se recoche.
//  - Durée de vie : 30 jours. Au-delà, il est jeté (les jours d'entraînement
//    d'il y a deux mois ne décrivent plus la semaine du joueur).
//
// ─── QUAND IL DISPARAÎT ────────────────────────────────────────────────────
//  - à la finalisation du questionnaire ;
//  - dès qu'on constate que le profil distant est DÉJÀ complet (un ancien
//    brouillon n'écrase jamais un profil finalisé ou modifié ailleurs) ;
//  - à la suppression du compte (services/accountDeletionHelpers) ;
//  - à l'expiration.
//
// ─── À LA DÉCONNEXION : IL RESTE, ET C'EST DIT ─────────────────────────────
// « Changer de compte » pendant le questionnaire ne détruit pas la saisie : le
// brouillon reste chiffré sur ce téléphone et ne se recharge qu'après une
// nouvelle connexion AU MÊME COMPTE (mot de passe requis). C'est la même
// politique que les instantanés par compte des stores (state/orchestrators/
// resetUser), en plus strict puisque chiffré. Un autre compte ne le voit jamais.

import {
  getEncryptedItem,
  removeEncryptedItem,
  setEncryptedItem,
} from "./encryptedStorage";
import { STORAGE_KEYS } from "../constants/storage";

export const SETUP_DRAFT_VERSION = 1;
export const SETUP_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const SETUP_DRAFT_TOTAL_STEPS = 4;

const DOW = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** Les réponses conservées. Toutes facultatives : un brouillon est partiel par nature. */
export type SetupDraftAnswers = {
  firstName?: string;
  position?: string;
  ageCategory?: string;
  level?: string;
  dominantFoot?: string;
  mainObjective?: string;
  targetFksSessionsPerWeek?: string;
  selfReportedGapOption?: string;
  hasClubTrainings?: "oui" | "non" | "";
  clubTrainingDays?: string[];
  matchDays?: string[];
  hasGymAccess?: "oui" | "occasionnel" | "non" | "";
  geneSetup?: "oui" | "non" | "";
  geneZone?: string;
  /** `null` = gravité explicitement retirée. */
  geneGravite?: 1 | 2 | 3 | null;
};

export type SetupDraft = {
  version: number;
  uid: string;
  savedAt: number;
  step: number;
  answers: SetupDraftAnswers;
};

export type DraftStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const stockageChiffre: DraftStorage = {
  getItem: getEncryptedItem,
  setItem: setEncryptedItem,
  removeItem: removeEncryptedItem,
};

// ABSENT ≠ VIDÉ. Une clé absente du brouillon veut dire « le joueur n'y a pas
// touché » ; une clé présente et vide ("" ou []) veut dire « il l'a effacée ».
// La distinction est conservée à l'écriture ET à la relecture : sans elle, des
// jours de match décochés revenaient depuis l'ancien profil distant.
const texte = (v: unknown, max = 80): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length <= max ? t : undefined;
};
const parmi = <T extends string>(v: unknown, valeurs: readonly T[]): T | "" | undefined =>
  v === "" ? "" : typeof v === "string" && (valeurs as readonly string[]).includes(v) ? (v as T) : undefined;
const jours = (v: unknown): string[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const propres = v.filter((j): j is string => typeof j === "string" && (DOW as readonly string[]).includes(j));
  return [...new Set(propres)];
};

/**
 * Ne laisse passer que les clés connues, aux formes connues. Tout le reste est
 * jeté en silence : c'est ce qui garantit qu'aucun secret ne peut entrer ici,
 * même si un appelant passait par erreur un objet plus large.
 */
export function sanitizeDraftAnswers(raw: unknown): SetupDraftAnswers {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: SetupDraftAnswers = {};
  const poser = <K extends keyof SetupDraftAnswers>(k: K, v: SetupDraftAnswers[K] | undefined) => {
    if (v !== undefined) out[k] = v;
  };
  poser("firstName", texte(r.firstName, 40));
  poser("position", texte(r.position));
  poser("ageCategory", texte(r.ageCategory, 12));
  poser("level", texte(r.level));
  poser("dominantFoot", texte(r.dominantFoot));
  poser("mainObjective", texte(r.mainObjective, 120));
  poser("targetFksSessionsPerWeek", parmi(r.targetFksSessionsPerWeek, ["1", "2", "3", "4"] as const));
  poser("selfReportedGapOption", texte(r.selfReportedGapOption, 12));
  poser("hasClubTrainings", parmi(r.hasClubTrainings, ["oui", "non"] as const));
  poser("clubTrainingDays", jours(r.clubTrainingDays));
  poser("matchDays", jours(r.matchDays));
  poser("hasGymAccess", parmi(r.hasGymAccess, ["oui", "occasionnel", "non"] as const));
  poser("geneSetup", parmi(r.geneSetup, ["oui", "non"] as const));
  poser("geneZone", texte(r.geneZone, 24));
  if (r.geneGravite === 1 || r.geneGravite === 2 || r.geneGravite === 3 || r.geneGravite === null) out.geneGravite = r.geneGravite;
  return out;
}

export function createSetupDraftStore(storage: DraftStorage = stockageChiffre, now: () => number = Date.now) {
  const cle = (uid: string) => STORAGE_KEYS.SETUP_DRAFT(uid);
  const uidPropre = (uid: string | null | undefined) => (typeof uid === "string" ? uid.trim() : "");

  // ── COORDINATION PAR COMPTE ─────────────────────────────────────────────
  // Les écritures et suppressions d'UN compte passent par UNE file : elles
  // s'exécutent dans l'ordre où elles ont été demandées, jamais dans l'ordre
  // où le disque répond. Deux garanties en découlent :
  //   . la DERNIÈRE sauvegarde demandée est celle qui reste (une sauvegarde
  //     dépassée par une plus récente ne s'écrit même pas) ;
  //   . une suppression passe APRÈS toute écriture déjà engagée, et neutralise
  //     celles qui attendaient encore : rien d'antérieur ne recrée le brouillon.
  // Chaque compte a sa propre file et ses propres compteurs : un compte lent ne
  // retarde ni ne périme jamais l'autre.
  type EtatCompte = { file: Promise<unknown>; demande: number; derniereSauvegarde: number; derniereSuppression: number };
  const etats = new Map<string, EtatCompte>();
  const etatDe = (u: string): EtatCompte => {
    let e = etats.get(u);
    if (!e) {
      e = { file: Promise.resolve(), demande: 0, derniereSauvegarde: 0, derniereSuppression: 0 };
      etats.set(u, e);
    }
    return e;
  };
  const enfiler = <T>(u: string, tache: () => Promise<T>): Promise<T> => {
    const e = etatDe(u);
    const suite = e.file.then(tache, tache);
    e.file = suite.catch(() => undefined);
    return suite;
  };

  async function retirer(u: string): Promise<void> {
    try {
      await storage.removeItem(cle(u));
    } catch {
      // Best effort : un brouillon qui survit est revérifié (compte, âge,
      // profil complet) avant toute réutilisation.
    }
  }

  /**
   * Suppression COORDONNÉE : attend les écritures déjà engagées pour ce compte,
   * neutralise celles qui attendaient, puis retire. Ne jette jamais.
   */
  function clear(uid: string | null | undefined): Promise<void> {
    const u = uidPropre(uid);
    if (!u) return Promise.resolve();
    const e = etatDe(u);
    e.demande += 1;
    e.derniereSuppression = e.demande;
    return enfiler(u, () => retirer(u));
  }

  /** Rend `true` si le brouillon a été écrit. Ne jette jamais. */
  async function save(uid: string | null | undefined, draft: { step: number; answers: unknown }): Promise<boolean> {
    const u = uidPropre(uid);
    if (!u) return false;
    const answers = sanitizeDraftAnswers(draft.answers);
    const step = Math.min(SETUP_DRAFT_TOTAL_STEPS - 1, Math.max(0, Math.trunc(Number(draft.step) || 0)));
    // Rien de saisi : on n'écrit pas un brouillon vide par-dessus un vrai.
    if (Object.keys(answers).length === 0 && step === 0) return false;
    const valeur: SetupDraft = { version: SETUP_DRAFT_VERSION, uid: u, savedAt: now(), step, answers };
    const e = etatDe(u);
    e.demande += 1;
    const mienne = e.demande;
    e.derniereSauvegarde = mienne;
    return enfiler(u, async () => {
      // Dépassée par une sauvegarde plus récente, ou suivie d'une suppression :
      // on n'écrit pas (la plus récente, ou le vide, doit rester).
      if (mienne < e.derniereSauvegarde || mienne < e.derniereSuppression) return false;
      try {
        await storage.setItem(cle(u), JSON.stringify(valeur));
        return true;
      } catch {
        return false;
      }
    });
  }

  /** Le brouillon de CE compte, ou `null` (absent, d'un autre compte, périmé, illisible). Ne jette jamais. */
  async function load(uid: string | null | undefined): Promise<SetupDraft | null> {
    const u = uidPropre(uid);
    if (!u) return null;
    let raw: string | null = null;
    try {
      // La lecture passe après les écritures engagées : on relit ce qui RESTE.
      await etatDe(u).file;
      raw = await storage.getItem(cle(u));
    } catch {
      return null;
    }
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<SetupDraft>;
      const age = typeof parsed?.savedAt === "number" ? now() - parsed.savedAt : Number.NaN;
      const valide =
        parsed &&
        parsed.version === SETUP_DRAFT_VERSION &&
        parsed.uid === u &&
        Number.isFinite(age) &&
        age <= SETUP_DRAFT_MAX_AGE_MS &&
        age >= -60_000;
      if (!valide) {
        await clear(u);
        return null;
      }
      return {
        version: SETUP_DRAFT_VERSION,
        uid: u,
        savedAt: parsed.savedAt as number,
        step: Math.min(SETUP_DRAFT_TOTAL_STEPS - 1, Math.max(0, Math.trunc(Number(parsed.step) || 0))),
        answers: sanitizeDraftAnswers(parsed.answers),
      };
    } catch {
      await clear(u);
      return null;
    }
  }

  return { save, load, clear };
}

/** L'instance de l'application (stockage chiffré). */
export const setupDraft = createSetupDraftStore();
