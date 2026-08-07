// components/profilVNext/profilVNextAccents.ts
// =============================================================================
// PROTOTYPE Profil vNext — L'AXE « ACCENTS » (sobre / colore)
// =============================================================================
// Retour du fondateur (07/08) : l'ancien Profil avait de la vie visuelle
// (badges, pastilles) mais elle JURAIT avec le langage des autres ecrans. La
// reponse n'est ni le patchwork d'avant, ni l'austerite : de la couleur, DANS
// le langage du Home — sa famille d'accents (theme.colors.accent/accentSoft),
// ses pilules, ses rayons. L'orange d'action reste STRICTEMENT reserve a
// l'unique aplat du Home : aucun accent du Profil ne l'utilise.
//
// REGLE ABSOLUE : les accents ne changent JAMAIS une donnee. Meme texte au
// caractere pres dans les deux modes — l'avatar est un glyphe DESSINE (aucune
// initiale : une lettre serait un texte ajoute), les pilules ne font que
// teinter des mots qui existaient deja. Un test le verrouille
// (__tests__/profilVNext/accents.test.tsx).
//
// C'est une PRESENTATION (prop d'ecran, comme `echelle` au Home), pas une
// variante de contrat : le ViewModel ne sait pas que ca existe.
// =============================================================================

import { theme } from "../../constants/theme";

export type AccentsId = "sobre" | "colore";

export const ACCENTS_PAR_DEFAUT: AccentsId = "sobre";

export const ACCENTS_LIBELLES: Record<AccentsId, string> = {
  sobre: "Sobre",
  colore: "Coloré",
};

export const ACCENTS_A_COMPARER: ReadonlyArray<{
  id: AccentsId;
  libelle: string;
  description: string;
}> = [
  {
    id: "sobre",
    libelle: "Sobre",
    description: "Le rendu de reference : la couleur ne vit que dans les marques de section.",
  },
  {
    id: "colore",
    libelle: "Coloré",
    description:
      "La meme information, avec la famille d'accents du Home : avatar dessine, " +
      "faits en pilules teintees, valeurs accentuees. Aucun texte ajoute ni retire.",
  },
];

/**
 * La palette d'un mode. Tout derive du theme (aucune couleur inventee ici) ;
 * `null` = garder la couleur du rendu sobre.
 */
export type PaletteAccents = {
  /** Fond des pilules de fait (cycle, club). */
  piluleFond: string | null;
  /** Texte des pilules de fait. */
  piluleTexte: string | null;
  /** Fond de la pilule « A definir » — NEUTRE : l'absence ne se celebre pas. */
  aDefinirFond: string | null;
  /** Valeurs du bloc rythme. */
  valeur: string | null;
  /** Chevrons des lignes de controle. */
  chevron: string | null;
  /** Avatar (glyphe dessine) : fond et trait. */
  avatarFond: string | null;
  avatarTrait: string | null;
};

const PALETTES: Record<AccentsId, PaletteAccents> = {
  sobre: {
    piluleFond: null,
    piluleTexte: null,
    aDefinirFond: null,
    valeur: null,
    chevron: null,
    avatarFond: null,
    avatarTrait: null,
  },
  colore: {
    piluleFond: theme.colors.accentSoft,
    piluleTexte: theme.colors.accent,
    aDefinirFond: theme.colors.borderSoft,
    valeur: theme.colors.accent,
    chevron: theme.colors.accent,
    avatarFond: theme.colors.accentSoft,
    avatarTrait: theme.colors.accent,
  },
};

export const paletteAccents = (accents: AccentsId): PaletteAccents => PALETTES[accents];
