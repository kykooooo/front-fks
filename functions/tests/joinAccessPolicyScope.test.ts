// functions/tests/joinAccessPolicyScope.test.ts
//
// LA POLITIQUE NE CONCERNE QUE LES FUTURS RATTACHEMENTS.
//
// Exigence de Kyllian (lot correctif B2.1) : prouver qu'un changement de
// `clubs/{clubId}.joinAccessPolicy` ne modifie AUCUN acces deja pose.
//
// ─── POURQUOI CE FICHIER EN PLUS DES TESTS DE MODULE ────────────────────────
// `joinAccessPolicy.test.ts` teste la fonction pure ; `coachAccess.test.ts`
// teste `ensureCoachAccessState` cas par cas. Aucun des deux ne rejoue le
// SCENARIO REEL : un club avec un effectif aux etats varies, une bascule de
// politique, puis le CHEMIN DE RESYNCHRO qui repasse sur chaque membre.
//
// C'est precisement ce chemin qui aurait pu tout balayer : le trigger
// `onUserWritten` (functions/src/triggers.ts) appelle `ensureCoachAccessState`
// A CHAQUE ENREGISTREMENT DE PROFIL, pour chaque joueur. Si la politique y etait
// reappliquee, un club qui coche "approbation requise" un mardi soir verrait son
// effectif se vider tout seul, joueur par joueur, au fil des sauvegardes des
// jours suivants — sans un mot d'ecran pour l'expliquer.
//
// Le magasin ci-dessous ECRIT REELLEMENT dans son etat : si une ecriture
// silencieuse se produisait, l'effectif final serait different, et la
// comparaison "avant / apres" tomberait. Un magasin qui se contenterait
// d'enregistrer les appels laisserait passer exactement ce qu'on cherche.

import {
  ensureCoachAccessState,
  type MemberAccessStore,
  type MemberSnapshot,
} from "../src/coachAccessSync";
import {
  comparerMemberRefs,
  runCoachAccessBackfill,
  type CoachAccessBackfillStore,
  type MemberRef,
} from "../src/coachAccessBackfill";
import { JOIN_ACCESS_POLICY_FIELD } from "../src/joinAccessPolicy";

const CLUB = "clubPilote";

/**
 * Effectif de depart : les QUATRE etats valides sont representes, plus deux cas
 * limites (champ absent, valeur illisible) qui sont les SEULS que la politique
 * a le droit de toucher.
 */
const EFFECTIF_INITIAL = (): Record<string, MemberSnapshot> => ({
  "joueurApprouve": { playerStatus: "active", coachAccess: "approved" },
  "joueurEnAttente": { playerStatus: "active", coachAccess: "pending" },
  "joueurRevoque": { playerStatus: "active", coachAccess: "revoked" },
  "joueurOuvert": { playerStatus: "active", coachAccess: "not_required" },
  "joueurAncien": { playerStatus: "active", coachAccess: undefined },
  "joueurCorrompu": { playerStatus: "active", coachAccess: "APPROVED" },
  "leCoach": { playerStatus: null, coachAccess: undefined },
});

type BaseFictive = {
  clubs: Record<string, Record<string, unknown>>;
  membres: Record<string, Record<string, MemberSnapshot>>;
  ecritures: { playerUid: string; state: string }[];
};

function baseFictive(politique?: unknown): BaseFictive {
  return {
    clubs: { [CLUB]: politique === undefined ? {} : { [JOIN_ACCESS_POLICY_FIELD]: politique } },
    membres: { [CLUB]: EFFECTIF_INITIAL() },
    ecritures: [],
  };
}

/** Magasin qui MUTE l'etat, comme le ferait Firestore. */
function magasin(base: BaseFictive): CoachAccessBackfillStore {
  return {
    async listPlayerMembers({ clubId, apres, max }): Promise<MemberRef[]> {
      const clubs = clubId ? [clubId] : Object.keys(base.membres);
      return clubs
        .flatMap((c) =>
          Object.entries(base.membres[c] ?? {})
            .filter(([, m]) => m.playerStatus === "active")
            .map(([playerUid]) => ({ clubId: c, playerUid })),
        )
        .filter((m) => !apres || comparerMemberRefs(m, apres) > 0)
        .sort(comparerMemberRefs)
        .slice(0, max);
    },
    async readMember(clubId, playerUid) {
      return base.membres[clubId]?.[playerUid] ?? null;
    },
    async readClubPolicy(clubId) {
      return base.clubs[clubId]?.[JOIN_ACCESS_POLICY_FIELD];
    },
    async writeCoachAccess(clubId, playerUid, state) {
      base.membres[clubId][playerUid] = { ...base.membres[clubId][playerUid], coachAccess: state };
      base.ecritures.push({ playerUid, state });
    },
  };
}

/** Photo de l'effectif : ce qu'on compare avant / apres. */
const photo = (base: BaseFictive) =>
  Object.fromEntries(
    Object.entries(base.membres[CLUB]).map(([uid, m]) => [uid, m.coachAccess]),
  );

/**
 * LE CHEMIN REEL : ce que fait le trigger `onUserWritten` quand chaque joueur
 * enregistre son profil, un par un.
 */
async function chaqueJoueurEnregistreSonProfil(base: BaseFictive): Promise<void> {
  const store = magasin(base);
  for (const uid of Object.keys(base.membres[CLUB])) {
    await ensureCoachAccessState(store, CLUB, uid);
  }
}

// ────────────────────────────────────────────────────────────────────────────
describe("changer la politique ne touche AUCUN acces existant", () => {
  it("une fois les etats stabilises, basculer en approval_required ne bouge rien", async () => {
    const base = baseFictive(); // politique absente = mode par defaut
    // 1er passage : il repare les deux cas limites (ancien / corrompu).
    await chaqueJoueurEnregistreSonProfil(base);
    const avant = photo(base);
    expect(avant).toEqual({
      joueurApprouve: "approved",
      joueurEnAttente: "pending",
      joueurRevoque: "revoked",
      joueurOuvert: "not_required",
      joueurAncien: "not_required", // repare, parce qu'il n'avait AUCUN etat
      joueurCorrompu: "not_required", // idem : "APPROVED" n'est pas une valeur
      leCoach: undefined, // un coach n'a pas d'acces a son propre suivi
    });

    // 2. LE COACH BASCULE LA POLITIQUE.
    base.clubs[CLUB][JOIN_ACCESS_POLICY_FIELD] = "approval_required";
    base.ecritures = [];

    // 3. La vie continue : chaque joueur enregistre son profil (le trigger
    //    repasse donc sur chacun d'eux, plusieurs fois).
    await chaqueJoueurEnregistreSonProfil(base);
    await chaqueJoueurEnregistreSonProfil(base);

    expect(photo(base)).toEqual(avant);
    expect(base.ecritures).toEqual([]);
  });

  it("repasser en mode par defaut n'OUVRE rien non plus", async () => {
    const base = baseFictive("approval_required");
    await chaqueJoueurEnregistreSonProfil(base);
    const avant = photo(base);
    expect(avant.joueurAncien).toBe("pending");
    expect(avant.joueurEnAttente).toBe("pending");

    base.clubs[CLUB][JOIN_ACCESS_POLICY_FIELD] = "automatic_safe_projection";
    base.ecritures = [];
    await chaqueJoueurEnregistreSonProfil(base);

    expect(photo(base)).toEqual(avant);
    expect(base.ecritures).toEqual([]);
    // Le point sensible, dit explicitement : les "pending" restent fermes.
    expect(photo(base).joueurEnAttente).toBe("pending");
  });

  it("une politique ILLISIBLE posee apres coup ne redistribue rien non plus", async () => {
    const base = baseFictive();
    await chaqueJoueurEnregistreSonProfil(base);
    const avant = photo(base);

    for (const pourrie of ["", "   ", "STRICT", "approval", 1, true, {}, null]) {
      base.clubs[CLUB][JOIN_ACCESS_POLICY_FIELD] = pourrie;
      base.ecritures = [];
      await chaqueJoueurEnregistreSonProfil(base);
      expect(photo(base)).toEqual(avant);
      expect(base.ecritures).toEqual([]);
    }
  });

  it("le script de mise a niveau, lance APRES la bascule, ne referme rien", async () => {
    // Le backfill emprunte la meme decision que le trigger : c'est le second
    // chemin qui aurait pu balayer un effectif, et il ne le fait pas non plus.
    const base = baseFictive();
    await chaqueJoueurEnregistreSonProfil(base);
    const avant = photo(base);

    base.clubs[CLUB][JOIN_ACCESS_POLICY_FIELD] = "approval_required";
    base.ecritures = [];
    const res = await runCoachAccessBackfill(magasin(base), {
      apply: true,
      clubId: CLUB,
      limite: 100,
    });

    expect(res.ok).toBe(true);
    expect(photo(base)).toEqual(avant);
    expect(base.ecritures).toEqual([]);
    expect(res.ok && res.stats.updated).toBe(0);
  });

  it("la bascule n'agit QUE sur celui qui rejoint APRES", async () => {
    // La contrepartie, prouvee dans le meme test pour qu'on ne puisse pas lire
    // le premier sans le second : la politique n'est pas decorative.
    const base = baseFictive();
    await chaqueJoueurEnregistreSonProfil(base);
    base.clubs[CLUB][JOIN_ACCESS_POLICY_FIELD] = "approval_required";

    // Un nouveau joueur entre : son membership est cree sans etat (c'est le
    // rattachement serveur qui le pose ; ici on regarde la resynchro).
    base.membres[CLUB]["nouveauJoueur"] = { playerStatus: "active", coachAccess: undefined };
    await chaqueJoueurEnregistreSonProfil(base);

    expect(photo(base).nouveauJoueur).toBe("pending");
    // ...et les anciens n'ont toujours pas bouge.
    expect(photo(base).joueurOuvert).toBe("not_required");
    expect(photo(base).joueurApprouve).toBe("approved");
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe("fermer un acces existant reste une operation EXPLICITE", () => {
  it("aucun module de ce lot n'expose une action groupee sur l'effectif", async () => {
    // Ce que ce test verrouille : personne n'a ajoute, "pour rendre service",
    // une fonction qui appliquerait la politique a tout un club. Le jour ou une
    // action groupee existera, elle sera un geste administrateur nomme, pas un
    // effet de bord d'un changement de reglage — et ce test tombera pour qu'on
    // le documente.
    const modules = [
      require("../src/joinAccessPolicy"),
      require("../src/coachAccess"),
      require("../src/coachAccessSync"),
    ];
    for (const m of modules) {
      const suspects = Object.keys(m).filter((k) =>
        /revokeAll|applyPolicyTo|resyncClub|enforcePolicy|bulk/i.test(k),
      );
      expect(suspects).toEqual([]);
    }
  });

  it("seule une ecriture explicite de l'etat ferme un acces", async () => {
    const base = baseFictive();
    await chaqueJoueurEnregistreSonProfil(base);
    // Le geste reel decrit dans AUTORISATION_ACCES.md §7.4 : poser "revoked" sur
    // UN membership. Rien d'autre ne ferme un acces.
    base.membres[CLUB]["joueurOuvert"] = { playerStatus: "active", coachAccess: "revoked" };
    await chaqueJoueurEnregistreSonProfil(base);
    expect(photo(base).joueurOuvert).toBe("revoked");
  });
});
