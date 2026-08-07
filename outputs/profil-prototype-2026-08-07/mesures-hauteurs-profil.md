# Hauteur de page — Profil actuel contre Profil vNext (pur / informé)

Données FICTIVES. Mesure faite dans un vrai moteur de rendu (Chrome sans interface),
sur la vue « page entière » (rien n'est coupé), marges de safe area comprises.
Même moteur, même feuille de style, même méthode des trois côtés : l'écart ne peut
pas venir du harnais.

Généré par `node prototype/profil/verifier.js`.

## Hauteurs à l'échelle 1 (vue « page entière », safe area comprise)

| État | Largeur | Profil actuel | vNext pur | vNext informé | Écart informé vs actuel | Blocs actuel → informé |
|---|---:|---:|---:|---:|---:|---:|
| joueur-complet | 320 | 2330 px | 819 px | 849 px | -1481 px (-63.6 %) | 8 → 4 |
| joueur-complet | 375 | 2253 px | 869 px | 899 px | -1354 px (-60.1 %) | 8 → 4 |
| joueur-complet | 390 | 2256 px | 872 px | 902 px | -1354 px (-60 %) | 8 → 4 |
| compte-neuf | 320 | 2433 px | 811 px | 821 px | -1612 px (-66.3 %) | 8 → 4 |
| compte-neuf | 375 | 2325 px | 869 px | 879 px | -1446 px (-62.2 %) | 8 → 4 |
| compte-neuf | 390 | 2328 px | 872 px | 882 px | -1446 px (-62.1 %) | 8 → 4 |
| profil-partiel | 320 | 2418 px | 811 px | 831 px | -1587 px (-65.6 %) | 8 → 4 |
| profil-partiel | 375 | 2351 px | 869 px | 889 px | -1462 px (-62.2 %) | 8 → 4 |
| profil-partiel | 390 | 2354 px | 872 px | 892 px | -1462 px (-62.1 %) | 8 → 4 |
| chargement | 320 | 2248 px | 673 px | 703 px | -1545 px (-68.7 %) | 8 → 4 |
| chargement | 375 | 2171 px | 731 px | 761 px | -1410 px (-64.9 %) | 8 → 4 |
| chargement | 390 | 2174 px | 734 px | 764 px | -1410 px (-64.9 %) | 8 → 4 |
| proprietaire-club | 320 | 2361 px | 811 px | 857 px | -1504 px (-63.7 %) | 8 → 4 |
| proprietaire-club | 375 | 2253 px | 869 px | 899 px | -1354 px (-60.1 %) | 8 → 4 |
| proprietaire-club | 390 | 2256 px | 872 px | 902 px | -1354 px (-60 %) | 8 → 4 |
| sans-cycle | 320 | 2440 px | 819 px | 839 px | -1601 px (-65.6 %) | 8 → 4 |
| sans-cycle | 375 | 2329 px | 877 px | 897 px | -1432 px (-61.5 %) | 8 → 4 |
| sans-cycle | 390 | 2332 px | 880 px | 900 px | -1432 px (-61.4 %) | 8 → 4 |
| stress-textes-longs | 320 | 2389 px | 819 px | 881 px | -1508 px (-63.1 %) | 8 → 4 |
| stress-textes-longs | 375 | 2270 px | 877 px | 923 px | -1347 px (-59.3 %) | 8 → 4 |
| stress-textes-longs | 390 | 2273 px | 880 px | 926 px | -1347 px (-59.3 %) | 8 → 4 |

**Moyenne sur les 21 comparaisons : -62.7 % de hauteur de page (informé vs actuel).** Écrans qui tiennent SANS DÉFILER : 0/21 en informé, 1/21 en pur, 0/21 pour le Profil actuel.

## Texte ×1,3 (375 px, vue « page entière »)

| État | Profil actuel ×1,3 | vNext pur ×1,3 | vNext informé ×1,3 |
|---|---:|---:|---:|
| joueur-complet | 2514 px | 922 px | 984 px |
| compte-neuf | 2646 px | 922 px | 943 px |
| profil-partiel | 2622 px | 902 px | 944 px |
| chargement | 2423 px | 764 px | 826 px |
| proprietaire-club | 2514 px | 922 px | 1005 px |
| sans-cycle | 2656 px | 922 px | 964 px |
| stress-textes-longs | 2603 px | 922 px | 1026 px |

Rappel de méthode : ×1,3 est une SIMULATION (tailles de police et interlignes multipliés dans le CSS) ; le vrai Dynamic Type d'iOS redistribue aussi des marges. Police système, pas San Francisco : hauteurs justes à quelques pixels près.
