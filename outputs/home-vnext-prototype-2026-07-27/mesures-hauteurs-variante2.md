# Hauteurs de page — variante 1 (lien flottant) vs variante 2 (carte integree)

Mesure faite dans Chrome sans interface, sur les pages generees par `build.js`, en vue « page entiere »
(aucune hauteur imposee : c'est la hauteur reelle du contenu). Le nombre du haut de colonne est la
hauteur totale de l'ecran, marges de safe area comprises.

La colonne « tient sans defiler » compare cette hauteur a la zone visible de l'appareil,
soit `hauteur d'ecran - (49 pt de barre d'onglets + inset bas)`.

| Cas (carte) | Ecran hote | Largeur | Echelle | v1 | v2 | Ecart | Ecart % | Tient v1 | Tient v2 |
|---|---|---:|---:|---:|---:|---:|---:|:--:|:--:|
| v2-nouveau-joueur | nouveau-joueur | 320 | x1 | 359 px | 435 px | +76 px | 21.2 % | oui | oui |
| v2-nouveau-joueur | nouveau-joueur | 375 | x1 | 399 px | 493 px | +94 px | 23.6 % | oui | oui |
| v2-nouveau-joueur | nouveau-joueur | 375 | x1.3 | 469 px | 569 px | +100 px | 21.3 % | oui | oui |
| v2-nouveau-joueur | nouveau-joueur | 390 | x1 | 402 px | 480 px | +78 px | 19.4 % | oui | oui |
| v2-nouveau-joueur | nouveau-joueur | 768 | x1 | 323 px | 419 px | +96 px | 29.7 % | oui | oui |
| v2-deux-seances-tendance-indisponible | tendance-indisponible | 320 | x1 | 563 px | 669 px | +106 px | 18.8 % | non | non |
| v2-deux-seances-tendance-indisponible | tendance-indisponible | 375 | x1 | 603 px | 709 px | +106 px | 17.6 % | oui | oui |
| v2-deux-seances-tendance-indisponible | tendance-indisponible | 375 | x1.3 | 723 px | 839 px | +116 px | 16 % | oui | non |
| v2-deux-seances-tendance-indisponible | tendance-indisponible | 390 | x1 | 606 px | 698 px | +92 px | 15.2 % | oui | oui |
| v2-deux-seances-tendance-indisponible | tendance-indisponible | 768 | x1 | 527 px | 637 px | +110 px | 20.9 % | oui | oui |
| v2-tendance-disponible | tendance-disponible | 320 | x1 | 643 px | 734 px | +91 px | 14.2 % | non | non |
| v2-tendance-disponible | tendance-disponible | 375 | x1 | 667 px | 758 px | +91 px | 13.6 % | oui | non |
| v2-tendance-disponible | tendance-disponible | 375 | x1.3 | 772 px | 899 px | +127 px | 16.5 % | non | non |
| v2-tendance-disponible | tendance-disponible | 390 | x1 | 670 px | 761 px | +91 px | 13.6 % | oui | oui |
| v2-tendance-disponible | tendance-disponible | 768 | x1 | 593 px | 684 px | +91 px | 15.3 % | oui | oui |
| v2-test-physique-ameliore | seance-terminee | 320 | x1 | 645 px | 736 px | +91 px | 14.1 % | non | non |
| v2-test-physique-ameliore | seance-terminee | 375 | x1 | 669 px | 760 px | +91 px | 13.6 % | oui | non |
| v2-test-physique-ameliore | seance-terminee | 375 | x1.3 | 774 px | 901 px | +127 px | 16.4 % | non | non |
| v2-test-physique-ameliore | seance-terminee | 390 | x1 | 672 px | 763 px | +91 px | 13.5 % | oui | non |
| v2-test-physique-ameliore | seance-terminee | 768 | x1 | 595 px | 686 px | +91 px | 15.3 % | oui | oui |
| v2-aucune-comparaison-de-test | seance-prevue-aujourdhui | 320 | x1 | 811 px | 922 px | +111 px | 13.7 % | non | non |
| v2-aucune-comparaison-de-test | seance-prevue-aujourdhui | 375 | x1 | 833 px | 944 px | +111 px | 13.3 % | non | non |
| v2-aucune-comparaison-de-test | seance-prevue-aujourdhui | 375 | x1.3 | 1011 px | 1187 px | +176 px | 17.4 % | non | non |
| v2-aucune-comparaison-de-test | seance-prevue-aujourdhui | 390 | x1 | 836 px | 947 px | +111 px | 13.3 % | non | non |
| v2-aucune-comparaison-de-test | seance-prevue-aujourdhui | 768 | x1 | 723 px | 816 px | +93 px | 12.9 % | oui | oui |
| v2-donnee-manquante | tendance-indisponible | 320 | x1 | 563 px | 591 px | +28 px | 5 % | non | non |
| v2-donnee-manquante | tendance-indisponible | 375 | x1 | 603 px | 617 px | +14 px | 2.3 % | oui | oui |
| v2-donnee-manquante | tendance-indisponible | 375 | x1.3 | 723 px | 753 px | +30 px | 4.1 % | oui | non |
| v2-donnee-manquante | tendance-indisponible | 390 | x1 | 606 px | 620 px | +14 px | 2.3 % | oui | oui |
| v2-donnee-manquante | tendance-indisponible | 768 | x1 | 527 px | 559 px | +32 px | 6.1 % | oui | oui |

**Moyenne sur 30 comparaisons : +89.2 px (+14.7 %).** Ecrans qui tiennent sans defiler : 20 en variante 1, 15 en variante 2, sur 30.
