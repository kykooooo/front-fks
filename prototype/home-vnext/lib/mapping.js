// prototype/home-vnext/lib/mapping.js
// =============================================================================
// CORRESPONDANCE 14 ETATS vNEXT <-> SCENARIOS DU HOME ACTUEL
// =============================================================================
//
// Regle de conduite : quand un etat du prototype n'a pas d'equivalent cote Home
// actuel, on le DIT dans la page plutot que d'afficher un etat approchant sans
// le signaler. Trois qualites de correspondance :
//
//   "exact"        — le Home actuel a bien cet etat, les donnees racontent la
//                    meme histoire. On compare ce qui est comparable.
//   "approximatif" — les donnees sont proches mais quelque chose differe. La
//                    difference est ecrite en toutes lettres.
//   "inexistant"   — le Home actuel n'a PAS cet etat. On montre quand meme ce
//                    que le joueur verrait vraiment, avec un bandeau rouge qui
//                    dit que l'ecran affiche ne connait pas la situation.
//
// Le champ `ecart` est affiche par le visualiseur ET par la page elle-meme.
// =============================================================================
"use strict";

const MAPPING = [
  {
    fixture: "nouveau-joueur",
    scenario: "nouveau-joueur",
    qualite: "exact",
    ecart: null,
  },
  {
    fixture: "seance-prevue-aujourdhui",
    scenario: "seance-prevue-aujourdhui",
    qualite: "exact",
    ecart: null,
  },
  {
    fixture: "seance-a-reprendre",
    scenario: "seance-prevue-aujourdhui",
    qualite: "inexistant",
    ecart:
      "Le Home actuel ne connait pas l'etat « seance commencee ». Aucun selecteur ne lit " +
      "l'avancement d'une seance : l'ecran affiche est donc RIGOUREUSEMENT LE MEME que " +
      "celui de l'etat « seance prevue aujourd'hui ». Un joueur qui s'est arrete au " +
      "troisieme bloc revoit « C'est parti ! », comme s'il n'avait rien fait.",
  },
  {
    fixture: "seance-terminee",
    scenario: "seance-terminee",
    qualite: "exact",
    ecart: null,
  },
  {
    fixture: "jour-recuperation",
    scenario: "recuperation",
    qualite: "approximatif",
    ecart:
      "Meme situation, mecanique opposee. Cote actuel, c'est l'ECRAN qui decide : quand " +
      "l'indicateur de charge passe sous un seuil, le bouton bascule sur « Journee recup » " +
      "et efface la seance deja prete. Cote prototype, la journee legere est une SEANCE " +
      "PRESCRITE comme une autre, avec son titre, sa duree et son « pourquoi ».",
  },
  {
    fixture: "jour-sans-seance",
    scenario: "match-imminent",
    qualite: "exact",
    ecart: null,
  },
  {
    fixture: "reprise-longue-interruption",
    scenario: "reprise-apres-interruption",
    qualite: "exact",
    ecart: null,
  },
  {
    fixture: "tendance-indisponible",
    scenario: "progression-indisponible",
    qualite: "approximatif",
    ecart:
      "Le Home actuel n'a pas d'etat « pas assez de donnees » : il trace toujours la " +
      "courbe, quelle qu'en soit la matiere. Le scenario montre donc le meme joueur " +
      "debutant, avec la courbe que l'app lui affiche aujourd'hui.",
  },
  {
    fixture: "tendance-disponible",
    scenario: "cycle-termine",
    qualite: "approximatif",
    ecart:
      "Pas d'etat « tendance disponible » distinct cote actuel — la courbe est toujours " +
      "la. On montre le scenario le plus proche en donnees (plusieurs seances derriere, " +
      "rien de prescrit aujourd'hui, joueur frais). Attention : dans ce scenario la " +
      "pastille de cycle disparait, mais pour une raison sans rapport (cycle a 12/12).",
  },
  {
    fixture: "erreur-generation",
    scenario: "apres-echec-generation",
    qualite: "inexistant",
    ecart:
      "Le Home actuel n'affiche jamais d'erreur de generation. L'echec vit dans l'ecran " +
      "de generation, sous forme de message fugace ; le Home, lui, revient a « Preparer " +
      "ma seance » comme si rien ne s'etait passe. Le scenario montre exactement ca, et " +
      "c'est bien le probleme : rien ne distingue un echec d'une journee normale.",
  },
  {
    fixture: "hors-ligne",
    scenario: "hors-ligne-erreur",
    qualite: "exact",
    ecart: null,
  },
  {
    fixture: "directive-club-absente",
    scenario: "seance-prevue-aujourdhui",
    qualite: "exact",
    ecart: null,
  },
  {
    fixture: "directive-club-non-appliquee",
    scenario: "seance-prevue-aujourdhui",
    qualite: "inexistant",
    ecart:
      "Le Home actuel n'affiche aucune directive club, appliquee ou non. L'ecran est " +
      "identique a celui de l'etat precedent : la consigne du coach n'existe nulle part " +
      "cote joueur.",
  },
  {
    fixture: "joueur-autonome-sans-club",
    scenario: "seance-prevue-aujourdhui",
    qualite: "approximatif",
    ecart:
      "Le Home actuel est strictement identique avec ou sans club — ce qui est justement " +
      "la propriete recherchee (doctrine 10). Le scenario affiche a un cycle Force la ou " +
      "la fixture est en Explosivite : seule la pastille de cycle differe.",
  },
  {
    fixture: "stress-textes-longs",
    scenario: "contenu-tres-long",
    qualite: "approximatif",
    ecart:
      "Ce n'est pas un etat produit mais un test de RESISTANCE de la mise en page, des " +
      "deux cotes. Les textes ne sont pas les memes mot pour mot (les deux ecrans " +
      "n'affichent pas les memes champs), mais ils sont pousses a des longueurs " +
      "comparables : prenom a rallonge, titre de seance interminable, raison longue.",
  },
];

/**
 * Scenarios du Home actuel qui n'ont AUCUNE contrepartie dans les 14 fixtures,
 * et qu'on garde accessibles quand meme : ils montrent des defauts que le
 * prototype ne peut pas illustrer faute de fixture correspondante.
 */
const EXTRAS_ACTUEL = [
  {
    scenario: "chargement",
    pourquoi:
      "Store non hydrate. Le Home actuel affiche un ecran d'usine (chiffres d'amorcage, " +
      "« Nouvelle serie ») pendant l'hydratation. Aucune fixture ne couvre ce moment : " +
      "elles ont toutes `storeHydrated: true`.",
  },
  // NOTE : `contenu-tres-long` n'est plus un extra. Il a desormais une
  // contrepartie vNext (la fixture `stress-textes-longs`), il est donc affiche
  // en comparaison cote a cote comme les autres etats.
  {
    scenario: "feedback-en-retard",
    pourquoi:
      "Seance faite il y a deux jours, toujours sans retour du joueur. Le contrat vNext " +
      "porte bien `feedbackGiven`, mais aucune des 14 fixtures ne met en scene un retard.",
  },
];

const byFixture = (id) => MAPPING.find((m) => m.fixture === id) ?? null;

module.exports = { MAPPING, EXTRAS_ACTUEL, byFixture };
