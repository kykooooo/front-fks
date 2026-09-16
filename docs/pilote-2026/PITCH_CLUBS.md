# PITCH CLUBS — FKS (version pilote)

> Document interne (Kyllian + Marvin). Support pour appels, rendez-vous et démos.
> Règle absolue : **un chiffre avancé = un chiffre prouvable** (liste fermée en §5).
> Rédigé le 03/08/2026 — chaque libellé d'écran cité ici a été vérifié dans l'app réelle.

---

## 1. Le pitch en 30 secondes

**L'accroche (1 phrase) :**
> « FKS, c'est le préparateur physique dans la poche de vos joueurs — entre deux entraînements club. »

**Le pitch complet (30 s) :**
> « Vos joueurs s'entraînent 2 ou 3 fois par semaine avec vous. Le reste du temps, soit ils ne font rien, soit ils font n'importe quoi trouvé sur YouTube. FKS leur donne une séance de préparation physique individuelle, adaptée à LEUR semaine : leurs entraînements avec vous, leur match du week-end, le matériel qu'ils ont vraiment — maison, salle ou terrain — leur fatigue et leurs douleurs. Le joueur fait la séance sur son téléphone, dit ce qu'il a réellement fait, et l'app ajuste la suite. Vous, coach, vous voyez qui travaille et ce qui a été fait — jamais leurs ressentis ni leurs douleurs, c'est verrouillé côté serveur. Résultat : des joueurs qui arrivent plus frais et mieux préparés le week-end, sans que vous ayez une ligne de programmation à faire. »

**Ce qu'on cherche avec le pilote (à dire tel quel) :**
> « On cherche 2-3 clubs pilotes pour valider l'usage sur un vrai vestiaire. Le cadre est simple : le pilote est gratuit pendant 8 à 12 semaines, vous avez un accès complet et un contact direct avec nous, et en échange on vous demande des retours structurés et honnêtes sur ce qui marche et ce qui ne marche pas. Le tarif d'après est annoncé dès le départ — pas de surprise. »

---

## 2. La démo téléphone (5 minutes)

### Avant la démo (10 minutes avant — obligatoire)

1. **Réveiller le serveur** : ouvrir `https://fks-backend-xmnb.onrender.com/ready` dans Safari. Attendre le `{"ok":true...}`. (Le serveur s'endort entre deux usages ; à froid, la première génération peut prendre 30 s de plus — on ne fait pas attendre un président de club.)
2. **Compte joueur démo prêt** : profil complet, cycle actif, **aucun feedback en attente** et **pas de séance déjà générée aujourd'hui** (sinon le bouton de génération est bloqué — c'est voulu).
3. **Compte coach démo prêt** : club créé, le compte joueur démo rattaché. ⚠️ À ne faire en live qu'après la recette coach complète (voir REGISTRE_RC) — en attendant, l'espace coach se montre en captures d'écran.
4. Téléphone chargé, réseau vérifié, luminosité à fond, notifications coupées, **captures d'écran de secours** dans la galerie (plan B réseau).

### Le script (libellés réels de l'app)

**0:00 – 0:45 · L'inscription**
- Écran d'accueil (« Ta prépa physique, ton avantage ») → **« Commencer »** → inscription en 3 champs.
- Setup en 4 étapes affichées « Étape 1/4 » : **Identité** → **Objectif** → **Club** (ses entraînements & matchs) → **Salle**.
- *À dire :* « Le joueur déclare une fois sa semaine réelle : ses entraînements avec vous, son jour de match, son matériel. Tout part de là. »

**0:45 – 2:00 · La séance générée**
- Onglet **« Séance »** → **« Où t'entraînes-tu ? »** (Salle / Terrain / Maison) → **« Matériel disponible »** → **« Valider le contexte »** → **« Générer une séance »**.
- La génération prend 20-30 secondes : meubler en expliquant ce que le moteur prend en compte.
- *À dire :* « Cette séance est fabriquée pour LUI, maintenant : son poste, son âge, sa fatigue, son match de samedi, le matériel qu'il a sous la main. Deux joueurs du même club n'ont pas la même séance. »

**2:00 – 3:15 · La boucle « Modifier » (le moment fort)**
- Lancer la séance → montrer les blocs, le minuteur, les consignes d'un exercice.
- Taper **« Modifier »** sur un exercice → la feuille propose **« Adapté »**, **« Sauté »**, **« Je ne peux pas faire cet exercice »** → montrer la **proposition de remplacement automatique**.
- *À dire :* « La vraie vie d'un amateur : pas de place, une gêne, pas le bon matériel. L'app propose un remplacement compatible — et elle RETIENT ce qui s'est passé pour la suite. Elle ne punit jamais un joueur honnête. »

**3:15 – 4:00 · Le retour du joueur et « Ton suivi »**
- Terminer → feedback : **« RPE séance »** (effort perçu /10), **« Fatigue »**, **« Récupération »**, **« Douleurs »**, **« Blessure »**.
- *À dire :* « 30 secondes de retour. Une douleur déclarée = plus aucun exercice dessus tant qu'elle est là. C'est la règle n°1 du moteur, elle passe avant tout le reste. »
- Profil → **« Progression »** → section **« Ton suivi »** : séances suivies, prévu vs réalisé, effort ressenti vs prévu, qualités travaillées sur 28 jours.
- *À dire :* « Le joueur voit ce qu'il a vraiment fait. Pas de courbes de laboratoire, pas de jargon. »

**4:00 – 5:00 · L'espace coach**
- Basculer sur le compte coach → onglets **« Aujourd'hui »**, **« Effectif »**, **« Semaine »** → ouvrir une fiche joueur : statut du jour, **« Prévu vs réalisé »**, historique, assiduité.
- **Lire à voix haute le pied de page de la fiche :** *« Lecture seule. Aucune donnée de santé (douleur, fatigue, ressenti) n'est transmise à l'encadrement. »*
- *À dire :* « Vous voyez qui bosse et ce qui a été fait. Vous ne voyez jamais leurs ressentis — et c'est exactement pour ça que les joueurs disent la vérité à l'app. C'est verrouillé côté serveur, pas juste masqué à l'écran. »

### Plan B (réseau capricieux)
Captures préparées dans la galerie, dans l'ordre du script : setup 4 étapes → séance générée → feuille « Modifier » → feedback → « Ton suivi » → 3 écrans coach. La démo se déroule à l'identique en racontant sur les captures.

---

## 3. La FAQ honnête

**« Combien ça coûte ? »**
> « Le pilote est gratuit, pendant une durée limitée : 8 à 12 semaines. En échange, on vous demande un engagement de retours structurés — un point court et régulier avec nous, les remontées de problèmes, le ressenti du vestiaire. Et on vous annonce dès le départ le tarif qui s'appliquera après le pilote, comme ça personne ne découvre une facture surprise. Ce qui est ferme : ce n'est pas gratuit à vie — une app qui ne vaut rien ne coûte rien, celle-là travaille pour vos joueurs toute la semaine. »
> ⚠️ *Interne : cadre ACTÉ (03/08) = gratuit limité 8-12 semaines contre retours structurés + tarif d'après annoncé dès le départ. Le MONTANT post-pilote reste à fixer (Kyllian + Marvin) avant le premier rendez-vous ; la durée exacte se cale club par club.*

**« Qu'est-ce que je vois des données de mes joueurs ? »**
> « Vous voyez : qui a une séance prévue, qui l'a faite, ce qui a été fait ou adapté, l'assiduité. Vous ne voyez JAMAIS : les douleurs, la fatigue, l'effort ressenti, les commentaires du joueur. Ce n'est pas un réglage, c'est verrouillé dans les règles du serveur — même nous, on ne peut pas vous l'afficher. C'est vérifié par plus de 500 tests automatiques de ces règles. Pourquoi ? Parce qu'un joueur qui sait que son coach lit ses douleurs arrête de les déclarer — et là, plus personne n'est protégé. »

**« Et les mineurs ? »**
> « Trois choses. Un : consentement parental obligatoire — au pilote, c'est un formulaire écrit signé par les parents, collecté avec le club, et on active le compte ensuite. Deux : données minimales, et rien de leur santé n'est visible par l'encadrement, comme pour les adultes. Trois : les dosages jeunes sont volontairement prudents et appuyés sur un référentiel scientifique — volumes de sprint plafonnés, impacts plafonnés par catégorie d'âge. »
> ⚠️ *Interne : le parcours de consentement dans l'app n'existe pas encore — au pilote c'est un process papier + activation manuelle. Ne pas promettre un flux in-app.*

**« Ça remplace le coach ? Le préparateur ? »**
> « Non, et ce n'est pas le but. FKS s'occupe de la préparation physique ENTRE vos séances — le créneau où aujourd'hui il ne se passe rien. Vous gardez le contexte : votre semaine, vos matchs, vos choix. L'app se cale sur ce que le joueur déclare de SA semaine de club, elle ne marche pas sur vos plates-bandes. Si le club a un préparateur, FKS est son relais individuel en semaine, pas son concurrent. »

**« Qui a validé les séances ? C'est de l'IA, non ? »**
> « Le moteur s'appuie sur un référentiel de 136 sources scientifiques que nous avons auditées une par une — dosages, récupération, volumes par âge. Et le point important : les règles de sécurité sont du code dur, pas de l'IA. L'IA rédige et personnalise ; elle ne peut PAS désarmer un plafond de volume, un filtre douleur ou une limite d'âge — c'est une règle d'architecture chez nous. On mesure la qualité des séances en interne avec une grille sévère, en continu, et le pilote sert exactement à confronter ça au terrain. »

**« Et si un joueur se blesse ? »**
> « Soyons honnêtes : aucune app n'empêche les blessures — méfiez-vous de qui vous promet ça. Ce que FKS fait : toute douleur déclarée écarte immédiatement les exercices concernés, règle absolue ; les volumes sont plafonnés par âge sur des bases publiées ; après un match, la séance est allégée d'office ; et si le joueur dit "je ne peux pas", l'app propose autre chose au lieu de forcer. Le pilote sert précisément à durcir ces garde-fous avec de vraies données de vestiaire. »

**« Mes joueurs sont sur Android… »**
> « Le pilote démarre sur iPhone (via TestFlight, l'app de test d'Apple — installation en 2 minutes). Android est prévu ensuite. Si votre vestiaire est majoritairement Android, dites-le nous tout de suite : ça pèse sur notre feuille de route. »
> ⚠️ *Interne : un profil de build APK Android existe dans la config mais n'a jamais été éprouvé — ne rien promettre de daté sans un build de test réussi.*

---

## 4. Ce qu'on NE promet PAS au pilote (liste ferme)

1. **Pas de vidéo pour chaque exercice.** Consignes écrites détaillées, oui ; la bibliothèque vidéo est en construction.
2. **Pas d'Android au lancement du pilote.** iPhone/TestFlight d'abord.
3. **Pas de planning de semaine complet affiché.** L'app propose séance par séance, calée sur la semaine déclarée du joueur.
4. **Pas d'ajustement invisible.** Le moteur d'apprentissage observe et propose ; rien ne change en douce dans le dos du joueur.
5. **Pas de promesse de performance chiffrée, ni de « zéro blessure ».**
6. **Pas de chat avec l'IA.** Retiré volontairement : FKS fait des séances, pas de la conversation.
7. **Pas de stats de match, pas de GPS.**
8. **Le coach ne verra pas les ressentis des joueurs — jamais.** C'est un choix de conception assumé, pas un manque.
9. **Pas de gratuité à vie.** Le pilote a un cadre ; l'app aura un prix.

---

## 5. Chiffres autorisés (chacun prouvable)

| Chiffre | Preuve |
|---|---|
| **136 sources scientifiques** auditées une par une pour les dosages | Référentiel de dosage FKS (03/08/2026), audit adversarial des sources inclus |
| **Plus de 500 tests automatiques** des règles serveur qui protègent les données joueurs | Suite rules : 503 tests verts sur l'arbre mergé (03/08) |
| **Plus de 3 700 tests automatisés** sur le moteur de génération | Suite backend feat/vague-85 : 3 749 tests |
| **Plus de 2 200 tests automatisés** sur l'app | Suite front au merge coach : 2 256 tests |
| **0 donnée de santé visible côté coach** | Par construction serveur (règles Firestore), affiché dans l'app |

**Interdits en clientèle** : toute note qualité interne (échelles internes, « 6,72 », « 7,2 »…) — ces chiffres n'ont de sens que pour nous ; « validé par des préparateurs professionnels » (faux à ce jour) ; toute promesse de résultat sportif ou médical.
