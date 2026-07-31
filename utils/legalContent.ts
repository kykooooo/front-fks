type LegalSection = {
  title: string;
  body: string[];
};

export const LEGAL_NOTICE: LegalSection[] = [
  {
    title: "Éditeur de l'application",
    body: [
      "Nom : Le Bris Kyllian",
      "Email : kyllian@fks-app.com",
      "Adresse : 12 rue Julius et Ethel Rosenberg, 76700 Gonfreville-l'Orcher",
      "Pays : France",
    ],
  },
  {
    title: "Hébergement des données",
    body: [
      "Les données sont hébergées sur les services Firebase (Google).",
      "Région de stockage : Union Européenne (UE).",
    ],
  },
  {
    title: "Propriété intellectuelle",
    body: [
      "L'ensemble des contenus (textes, visuels, programmes, design) est la propriété de l'éditeur, sauf mention contraire.",
      "Toute reproduction non autorisée est interdite.",
    ],
  },
  {
    title: "Contact",
    body: ["Pour toute question : kyllian@fks-app.com"],
  },
];

export const PRIVACY_POLICY: LegalSection[] = [
  {
    title: "Responsable du traitement",
    body: [
      "Nom : Le Bris Kyllian",
      "Email : kyllian@fks-app.com",
      "Adresse : 12 rue Julius et Ethel Rosenberg, 76700 Gonfreville-l'Orcher",
      "Pays : France",
    ],
  },
  {
    title: "Données collectées",
    body: [
      "Email (connexion).",
      "Nom / prénom (profil utilisateur).",
      "Données de santé : blessures, douleurs, fatigue (RPE).",
      "Données de performance : séances, tests, ATL/CTL/TSB.",
      "Données d'usage (analytics) : pages visitées, temps passé.",
    ],
  },
  {
    title: "Finalités",
    body: [
      "Personnaliser les séances d'entraînement.",
      "Calculer la charge d'entraînement (TSB) pour limiter les blessures.",
      "Améliorer l'application via analytics.",
      "Fournir un support technique en cas de problème.",
    ],
  },
  {
    title: "Base légale",
    body: ["Consentement explicite de l'utilisateur (case à cocher à l'inscription)."],
  },
  {
    title: "Durée de conservation",
    body: [
      "Données actives : tant que le compte existe.",
      "Données inactives : suppression 2 ans après la dernière connexion.",
    ],
  },
  {
    title: "Services tiers",
    body: [
      "Firebase (Google) : authentification et base de données.",
      "OpenAI : génération des séances.",
      "Amplitude : analyse d'utilisation.",
    ],
  },
  {
    title: "Droits des utilisateurs",
    body: [
      "Droit d'accès, de rectification, d'effacement.",
      "Droit d'opposition à certains traitements.",
      "Contact : kyllian@fks-app.com",
    ],
  },
  {
    title: "Mineurs de moins de 15 ans",
    body: [
      "En France, un mineur de moins de 15 ans ne peut pas consentir seul au traitement de ses données personnelles.",
      "Si tu as moins de 15 ans, ton parent ou responsable légal doit lire et accepter cette politique avant que tu utilises FKS. L'application te demande de le confirmer lors de la configuration de ton profil.",
      "Ton parent ou responsable légal peut exercer à tout moment tes droits (accès, rectification, effacement) en écrivant à : kyllian@fks-app.com",
    ],
  },
  {
    title: "Sécurité",
    body: [
      "Des mesures techniques et organisationnelles sont mises en place pour protéger les données.",
    ],
  },
];
