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
      "Données de santé : douleurs et fatigue ressenties après une séance, gênes et blessures que tu déclares dans « Mon corps ».",
      "Données de performance : séances, tests, ATL/CTL/TSB.",
      "Données d'usage (analytics) : pages visitées, temps passé.",
    ],
  },
  // Section AJOUTÉE avec l'espace « Mon corps », et écrite au plus juste.
  // Ce qu'elle NE dit PAS, volontairement : « tes données de santé restent sur
  // ton téléphone ». Ce serait faux et opposable — le score de douleur 0-5 saisi
  // au feedback part bien vers nos serveurs avec la séance. Seul le DÉTAIL des
  // gênes (zone, gravité, note) reste local. La distinction est faite ici parce
  // qu'elle est vraie, pas parce qu'elle est flatteuse.
  {
    title: "Où vivent tes données de santé",
    body: [
      "La douleur et la fatigue que tu notes après une séance sont enregistrées avec cette séance sur nos serveurs (Firebase). Elles servent à adapter tes séances suivantes et ne sont lues que par FKS.",
      "Le détail des gênes et blessures que tu déclares dans « Mon corps » (zone, gravité, note) reste stocké sur ton appareil et n'est envoyé à aucun serveur. Si tu changes de téléphone, ces déclarations sont perdues.",
      "Rien de tout cela n'est transmis à ton club ni à ton coach. Ton coach ne voit ni tes douleurs, ni les zones concernées, ni tes notes personnelles.",
      "Tu peux supprimer une gêne à tout moment depuis l'écran « Mon corps » : elle est alors effacée de ton appareil.",
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
      "Gênes et blessures déclarées dans « Mon corps » : conservées sur ton appareil jusqu'à ce que tu les supprimes, ou jusqu'à la désinstallation de l'application.",
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
