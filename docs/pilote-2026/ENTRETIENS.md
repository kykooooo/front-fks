# Entretiens terrain — notes brutes

Une fiche par personne. On note les mots de la personne, pas notre interpretation.
Pas de nom de famille, pas de numero ici : les contacts restent dans le telephone de Kyllian.

## Compteur

| Date | Lieu | Conversations | Coachs | Joueurs | Numeros pris |
|---|---|---|---|---|---|
| 20/09 | ESMGO, stade Maurice Baquet | | | | |

## Critere espace coach (fixe le 16/09, revise le 17/09 avant les entretiens)

Retour terrain rapporte par Kyllian le 17/09 : les coachs n'ont pas le temps de prescrire
ni de regler quoi que ce soit, ce ne sont pas des preparateurs physiques, c'est le travail
de l'appli. Ils veulent seulement un visuel : qui fait, qui ne fait pas. Pas de controle.

Trois issues possibles, a departager avec les reponses :

- **A. Rien pour le coach** : on merge la suppression du 14/09. Si les coachs disent
  « je n'ai pas besoin de savoir ».
- **B. L'espace coach actuel** (3 onglets, cadre de semaine a remplir) : seulement si un
  coach dit qu'il VEUT regler des choses. Le retour du 17/09 dit que non.
- **C. Un visuel en lecture seule** : fait / pas fait par joueur, jamais les douleurs ni la
  fatigue. Version zero code pendant le pilote : un message le lundi, fabrique a la main
  depuis Firestore (= le « tableau du lundi » de la decision marketing D10). Seule brique
  a garder dans l'app : le rattachement joueur -> club par code.

**Mise a jour du 21/09** : le retrait de l'espace coach a ete merge dans main le 17/09
(17f7697). Les issues A et B sont donc tranchees par les faits : il n'y a plus d'espace coach
dans l'app. Il reste a tester C dans sa version zero code, le message du lundi fabrique a la
main. Les questions aux coachs ne changent pas.

Hypothese de travail au 17/09 : **C**. On la confirme si au moins 2 coachs sur 3 repondent
« oui » a « tu voudrais savoir qui l'a fait ? » et preferent recevoir un message plutot
qu'ouvrir une appli.

| Coach | Veut regler / prescrire ? | Veut savoir qui l'a fait ? | Appli ou message du lundi ? | Ses mots |
|---|---|---|---|---|
| | | | | |

## Entretien Hamzaoui (ESMGO) — deroule prevu

Contexte et regles : voir ESMGO_ACCES.md. Rappel des trois temps.

1. **La reprise de contact** (une phrase, pas deux) :
   « Bonjour, Kyllian, je suis passe vous voir il y a un an avec mon projet de prepa
   physique. Vous m'aviez dit de revenir quand ce serait pret. C'est pret. »
2. **Le recadrage immediat** (c'est ce qui evite l'oral de demo) :
   « Avant de vous montrer quoi que ce soit, j'aimerais surtout comprendre comment vous,
   vous gerez le physique avec votre groupe. Vous auriez dix minutes, apres un
   entrainement ou quand ca vous arrange ? »
3. **S'il demande tout de suite « alors, c'est pret ou pas ? »**, repondre sans enjoliver :
   « Elle marche, je m'en sers. Elle est sur iPhone, Android arrive, et il n'y a pas encore
   les videos d'exercices. Ce que je cherche aujourd'hui, ce n'est pas de la mettre dans les
   mains de vos joueurs, c'est de savoir si ce qu'elle fait a du sens pour un coach comme
   vous. »

Les questions, dans l'ordre, en le laissant parler :
- Le physique, vous le faites sur votre temps de seance ? Combien de temps ca vous prend ?
- Qu'est-ce que vous envoyez a vos joueurs l'ete, avant la reprise ? Qui le fait vraiment ?
- En octobre, vous avez combien de blesses musculaires d'habitude ?
- Si vos joueurs faisaient le physique chez eux, serieusement, vous recupereriez combien de
  temps de ballon ?
- Et comment vous sauriez qu'ils l'ont fait ?
- Aujourd'hui l'appli decide seule a partir de ce que le joueur declare. Est-ce que ca vous
  irait, ou il faudrait que vous puissiez dire ce que vous voulez pour la semaine ?

Fin d'entretien, quoi qu'il dise : le remercier, ne rien proposer, ne rien promettre.
La proposition de pilote vient dans un deuxieme rendez-vous, jamais dans le premier.

## Fiche type

### Prenom — role — club / equipe — niveau — date

- **Telephone** : iPhone / Android
- **Age approx. et declencheur eventuel** : retour de blessure, reprise, ambition, 28 ans et plus, aucun
- **Q1. Physique ces deux dernieres semaines hors club** :
- **Q2. Ce qui l'a fait commencer, ou ce qui l'empeche** :
- **Q3. Ce qu'il paie deja** : salle / appli / coach / rien — combien
- **Q4. Quand il s'entraine seul, il fait quoi** : du physique, du ballon, les deux, rien
  (question de comportement, pas d'opinion : ne jamais demander « tu voudrais du ballon
  dans l'appli ? ». B42 melange athletique et ballon ; FKS est zero ballon par decision.
  On veut savoir ce que les joueurs FONT, pas ce qu'ils disent vouloir.)
- **Pour un coach : programme de reprise** : ce qu'il envoie, sous quelle forme, qui le fait vraiment
- **Pour un coach : le postulat fondateur** (le coach garde le ballon, FKS prend le physique) :
  « Le physique, tu le fais sur ton temps de seance ? Si tes joueurs le faisaient chez eux,
  serieusement, tu recupererais combien de temps de ballon ? » Noter le chiffre et ses mots.
  Puis : « Et comment tu saurais qu'ils l'ont fait ? »
  Puis : « Tu prefererais ouvrir une appli pour le voir, ou recevoir un message le lundi
  avec la liste de ceux qui ont bosse ? »
- **Phrase a retenir, mot pour mot** :
- **Partant pour tester ?** oui / non / peut-etre
- **Suite** : rappeler le … / passer a l'entrainement du … / rien
