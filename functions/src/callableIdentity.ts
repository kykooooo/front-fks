// functions/src/callableIdentity.ts
//
// LE SEUL ENDROIT OU L'IDENTITE D'UN APPELANT EST LUE.
//
// Toutes les callables de ce dossier passent par ici, et aucune ne lit un
// identifiant d'utilisateur ailleurs. L'identite vient de `request.auth`, que le
// runtime callable remplit APRES avoir verifie le jeton Firebase — jamais de
// `request.data`, qui est de la saisie client et rien d'autre.
//
// POURQUOI UNE FONCTION, ET PAS TROIS LIGNES RECOPIEES CINQ FOIS. Une regle
// d'identite recopiee est une regle qui derive : il suffit qu'une copie oublie un
// cas pour que la porte la plus faible devienne la porte du systeme. Ici, une
// seule lecture, verrouillee par les tests d'enveloppe.
//
// CE QUE CETTE FONCTION N'EST PAS : un point d'injection. Elle prend la REQUETE,
// pas une identite. On ne peut donc pas lui passer « qui je pretends etre » :
// le seul moyen d'obtenir un uid est de presenter une requete dont `auth` a ete
// remplie par le runtime. Les tests fabriquent la requete ; ils ne
// court-circuitent jamais la lecture.
//
// DURCISSEMENT (defense en profondeur). Le type est verifie STRICTEMENT : un
// `uid` non-chaine est refuse au lieu d'etre converti. En production le runtime
// ne produit qu'une chaine, donc ce cas est inatteignable et le comportement est
// inchange ; mais convertir silencieusement (`String(42)` -> `"42"`) aurait fait
// d'une eventuelle anomalie amont un identifiant valide, sur un chemin qui
// supprime des donnees (deleteAccount). Refuser coute une ligne.

/** Forme minimale exigee : ce module ne lit RIEN d'autre de la requete. */
export type CallerIdentitySource = {
  auth?: { uid?: unknown } | null;
};

/**
 * Renvoie l'uid du JETON, nettoye de ses espaces, ou `null` si l'appel n'a pas
 * d'identite exploitable (non authentifie, `uid` absent, vide, blanc, ou d'un
 * autre type). L'appelant decide du message de refus : chaque callable garde le
 * sien.
 */
export function readCallerUid(request: CallerIdentitySource): string | null {
  const uid = request.auth?.uid;
  if (typeof uid !== "string") return null;
  const trimmed = uid.trim();
  return trimmed ? trimmed : null;
}
