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
    title: "Avertissement medical",
    body: [
      "FKS n'est pas un dispositif medical et ne remplace en aucun cas l'avis d'un professionnel de sante.",
      "Les seances generees sont des suggestions d'entrainement. Elles ne constituent pas un diagnostic, un traitement ou une prescription.",
      "Avant de commencer un programme d'entrainement, consulte ton medecin, en particulier si tu as des antecedents medicaux, une blessure ou des douleurs.",
      "En cas de douleur aigue, essoufflement anormal, vertige ou malaise pendant une seance : arrete immediatement et consulte un medecin ou les urgences (15 / 112).",
      "L'editeur decline toute responsabilite en cas de blessure, accident ou probleme de sante lie a l'utilisation de l'application.",
    ],
  },
  {
    title: "Utilisateurs mineurs",
    body: [
      "L'application est destinee aux joueurs de 15 ans et plus. En dessous de 15 ans, l'usage est interdit sans supervision d'un adulte (parent, educateur ou coach).",
      "Pour les mineurs entre 15 et 17 ans : l'inscription necessite l'autorisation parentale prealable. Les parents ou representants legaux sont responsables du bon usage de l'application par le mineur.",
      "Les charges et intensites proposees par l'application sont adaptees aux adultes. Pour les mineurs, il est vivement recommande d'etre encadre par un coach certifie et de reduire les volumes proposes.",
      "Pour toute question relative aux donnees d'un mineur : fks.entreprise@gmail.com",
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
    title: "Donnees de sante - art. 9 RGPD",
    body: [
      "Les zones sensibles que tu declares (gene au genou, cheville...) sont des donnees de sante au sens de l'article 9 du RGPD. A ce titre :",
      "Base legale : consentement explicite separe, recueilli via deux cases a cocher distinctes (disclaimer medical + acceptation RGPD) au moment de la declaration.",
      "Finalite unique : adapter tes seances pour proteger ta zone sensible. Aucun autre usage, aucun partage avec un tiers.",
      "Donnees concernees : zone du corps (cheville, genou...), niveau de gene, date de declaration, restrictions selectionnees.",
      "Stockage : Firebase (Google) en Union Europeenne uniquement. Pas d'envoi HealthKit ni Google Fit.",
      "Conservation : tant que la zone sensible est active dans ton profil + 2 ans apres la derniere connexion.",
      "Droit de retrait : tu peux retirer ton consentement a tout moment en marquant la zone comme resolue ou en supprimant ton compte.",
    ],
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
