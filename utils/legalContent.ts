type LegalSection = {
  title: string;
  body: string[];
};

export const LEGAL_NOTICE: LegalSection[] = [
  {
    title: "Editeur de l'application",
    body: [
      "Nom : Le Bris Kyllian",
      "Email : fks.entreprise@gmail.com",
      "Adresse : [A completer]",
      "Pays : France",
    ],
  },
  {
    title: "Hebergement des donnees",
    body: [
      "Les donnees sont hebergees sur les services Firebase (Google).",
      "Region de stockage : Union Europeenne (UE).",
    ],
  },
  {
    title: "Propriete intellectuelle",
    body: [
      "L'ensemble des contenus (textes, visuels, programmes, design) est la propriete de l'editeur, sauf mention contraire.",
      "Toute reproduction non autorisee est interdite.",
    ],
  },
  {
    title: "Contact",
    body: ["Pour toute question : fks.entreprise@gmail.com"],
  },
];

export const PRIVACY_POLICY: LegalSection[] = [
  {
    title: "Responsable du traitement",
    body: [
      "Nom : Le Bris Kyllian",
      "Email : fks.entreprise@gmail.com",
      "Adresse : [A completer]",
      "Pays : France",
    ],
  },
  {
    title: "Donnees collectees",
    body: [
      "Email (connexion).",
      "Nom / prenom (profil utilisateur).",
      "Donnees de sante : blessures, douleurs, fatigue (RPE).",
      "Donnees de performance : seances, tests, ATL/CTL/TSB.",
      "Donnees d'usage (analytics) : pages visitees, temps passe.",
    ],
  },
  {
    title: "Finalites",
    body: [
      "Personnaliser les seances d'entrainement.",
      "Calculer la charge d'entrainement (TSB) pour limiter les blessures.",
      "Ameliorer l'application via analytics.",
      "Fournir un support technique en cas de probleme.",
    ],
  },
  {
    title: "Base legale",
    body: ["Consentement explicite de l'utilisateur (case a cocher a l'inscription)."],
  },
  {
    title: "Duree de conservation",
    body: [
      "Donnees actives : tant que le compte existe.",
      "Donnees inactives : suppression 2 ans apres la derniere connexion.",
    ],
  },
  {
    title: "Services tiers",
    body: [
      "Firebase (Google) : authentification et base de donnees.",
      "OpenAI : generation des seances.",
      "Amplitude : analyse d'utilisation.",
      "Sentry : detection et correction de bugs.",
    ],
  },
  {
    title: "Droits des utilisateurs",
    body: [
      "Droit d'acces, de rectification, d'effacement.",
      "Droit d'opposition a certains traitements.",
      "Contact : fks.entreprise@gmail.com",
    ],
  },
  {
    title: "Securite",
    body: [
      "Des mesures techniques et organisationnelles sont mises en place pour proteger les donnees.",
    ],
  },
];
