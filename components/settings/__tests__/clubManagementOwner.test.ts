// components/settings/__tests__/clubManagementOwner.test.ts
//
// LA CARTE « MON CLUB » NE PROPOSE PLUS UN GESTE IMPOSSIBLE.
//
// Depuis le transfert de propriété, un JOUEUR peut devenir propriétaire de son
// club tout en gardant l'application joueur (`users/{uid}.role` n'est jamais
// touché par le transfert — le basculer retirerait à un joueur actif sa propre
// app d'entraînement). Cet écran-là lui proposait « Quitter le club », que les
// règles Firestore refusent au propriétaire : sa disparition fabriquerait un
// `ownerUid` qui désigne un non-membre. L'échec s'affichait en « Réessaie »,
// c'est-à-dire un conseil faux.
//
// MÉTHODE ASSUMÉE : lecture de source, comme clubDisclosureWiring.test.ts. Le
// composant lit Firestore au montage (profil, club, appartenance) ; le monter
// pour de vrai demanderait de simuler trois lectures et un listener pour
// vérifier une seule chose — que le bouton est bien derrière le prédicat
// d'affichage. Le TEXTE et la DÉCISION, eux, sont testés pour de vrai dans
// domain/__tests__/clubRoles.test.ts.

import { readFileSync } from "fs";
import { resolve } from "path";

const source = readFileSync(
  resolve(__dirname, "..", "ClubManagementCard.tsx"),
  "utf8",
);

describe("carte Mon club — le propriétaire ne voit pas « Quitter le club »", () => {
  test("le libellé d'appartenance vient du domaine, pas d'une chaîne écrite en dur", () => {
    expect(source).toMatch(/import\s*\{\s*clubMembershipCopy\s*\}\s*from/);
    expect(source).toContain("clubMembershipCopy(monAppartenance)");
    // Les anciens textes en dur ont disparu : sinon la carte dirait « Membre de
    // l'effectif » à un propriétaire.
    expect(source).not.toContain('<Text style={styles.clubCode}>Membre de l\'effectif</Text>');
    expect(source).not.toContain('<Badge label="Membre"');
  });

  test("le bouton de départ est CONDITIONNÉ, et l'alternative n'est pas un bouton", () => {
    expect(source).toContain("appartenance.peutQuitter ?");
    expect(source).toContain("Quitter le club");
    expect(source).toContain("appartenance.empechement");
    // Pas de bouton grisé : un bouton désactivé sans explication est une
    // impasse muette. On affiche la raison et le geste.
    expect(source).not.toMatch(/disabled=\{[^}]*peutQuitter/);
  });

  test("les DEUX axes sont lus sur SA PROPRE appartenance, jamais déduits d'ailleurs", () => {
    expect(source).toContain('doc(db, "clubs", clubId, "members", uid)');
    // Un seul instantané pour les deux champs : les lire séparément laisserait
    // afficher un état mi-ancien mi-nouveau.
    expect(source).toContain("lireAppartenance(memberSnap)");
    // Une lecture ratée ne devient pas une affirmation : on retombe sur `null`,
    // donc sur l'affichage neutre de membre.
    expect(source).toContain("setMonAppartenance({ accessRole: null, playerStatus: null })");
  });

  test("le rôle affiché n'accorde aucun droit : aucune écriture n'en dépend", () => {
    // `monAppartenance` ne sert qu'à l'affichage. S'il gardait une écriture, l'écran
    // deviendrait une seconde source d'autorité — et une source qui ment.
    const lignes = source.split("\n").filter((l) => l.includes("myRole"));
    for (const ligne of lignes) {
      expect(ligne).not.toMatch(/setDoc|updateDoc|deleteDoc|removeClubMembership/);
    }
  });
});
