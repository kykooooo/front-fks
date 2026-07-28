# Hauteurs de page — variante 1 (lien flottant) vs variante 2 (carte integree)

Mesure faite dans Chrome sans interface, sur les pages generees par `build.js`, en vue « page entiere »
(aucune hauteur imposee : c'est la hauteur reelle du contenu). Le nombre du haut de colonne est la
hauteur totale de l'ecran, marges de safe area comprises.

La colonne « tient sans defiler » compare cette hauteur a la zone visible de l'appareil,
soit `hauteur d'ecran - (49 pt de barre d'onglets + inset bas)`.

| Cas (carte) | Ecran hote | Largeur | Echelle | v1 | v2 | Ecart | Ecart % | Tient v1 | Tient v2 |
|---|---|---:|---:|---:|---:|---:|---:|:--:|:--:|
| v2-nouveau-joueur | nouveau-joueur | 320 | x1 | 363 px | 433 px | +70 px | 19.3 % | oui | oui |
| v2-nouveau-joueur | nouveau-joueur | 375 | x1 | 401 px | 491 px | +90 px | 22.4 % | oui | oui |
| v2-nouveau-joueur | nouveau-joueur | 375 | x1.3 | 475 px | 574 px | +99 px | 20.8 % | oui | oui |
| v2-nouveau-joueur | nouveau-joueur | 390 | x1 | 404 px | 478 px | +74 px | 18.3 % | oui | oui |
| v2-nouveau-joueur | nouveau-joueur | 768 | x1 | 323 px | 417 px | +94 px | 29.1 % | oui | oui |
| v2-deux-seances-tendance-indisponible | tendance-indisponible | 320 | x1 | 588 px | 692 px | +104 px | 17.7 % | non | non |
| v2-deux-seances-tendance-indisponible | tendance-indisponible | 375 | x1 | 606 px | 712 px | +106 px | 17.5 % | oui | oui |
| v2-deux-seances-tendance-indisponible | tendance-indisponible | 375 | x1.3 | 732 px | 871 px | +139 px | 19 % | non | non |
| v2-deux-seances-tendance-indisponible | tendance-indisponible | 390 | x1 | 609 px | 715 px | +106 px | 17.4 % | oui | oui |
| v2-deux-seances-tendance-indisponible | tendance-indisponible | 768 | x1 | 528 px | 636 px | +108 px | 20.5 % | oui | oui |
| v2-tendance-disponible | tendance-disponible | 320 | x1 | 644 px | 716 px | +72 px | 11.2 % | non | non |
| v2-tendance-disponible | tendance-disponible | 375 | x1 | 666 px | 738 px | +72 px | 10.8 % | oui | non |
| v2-tendance-disponible | tendance-disponible | 375 | x1.3 | 774 px | 882 px | +108 px | 14 % | non | non |
| v2-tendance-disponible | tendance-disponible | 390 | x1 | 669 px | 741 px | +72 px | 10.8 % | oui | oui |
| v2-tendance-disponible | tendance-disponible | 768 | x1 | 592 px | 664 px | +72 px | 12.2 % | oui | oui |
| v2-test-physique-ameliore | seance-terminee | 320 | x1 | 646 px | 718 px | +72 px | 11.1 % | non | non |
| v2-test-physique-ameliore | seance-terminee | 375 | x1 | 668 px | 740 px | +72 px | 10.8 % | oui | non |
| v2-test-physique-ameliore | seance-terminee | 375 | x1.3 | 776 px | 884 px | +108 px | 13.9 % | non | non |
| v2-test-physique-ameliore | seance-terminee | 390 | x1 | 671 px | 743 px | +72 px | 10.7 % | oui | oui |
| v2-test-physique-ameliore | seance-terminee | 768 | x1 | 594 px | 666 px | +72 px | 12.1 % | oui | oui |
| v2-test-physique-en-recul | tendance-indisponible | 320 | x1 | 588 px | 747 px | +159 px | 27 % | non | non |
| v2-test-physique-en-recul | tendance-indisponible | 375 | x1 | 606 px | 767 px | +161 px | 26.6 % | oui | non |
| v2-test-physique-en-recul | tendance-indisponible | 375 | x1.3 | 732 px | 937 px | +205 px | 28 % | non | non |
| v2-test-physique-en-recul | tendance-indisponible | 390 | x1 | 609 px | 770 px | +161 px | 26.4 % | oui | non |
| v2-test-physique-en-recul | tendance-indisponible | 768 | x1 | 528 px | 691 px | +163 px | 30.9 % | oui | oui |
| v2-aucune-comparaison-de-test | seance-prevue-aujourdhui | 320 | x1 | 842 px | 960 px | +118 px | 14 % | non | non |
| v2-aucune-comparaison-de-test | seance-prevue-aujourdhui | 375 | x1 | 840 px | 938 px | +98 px | 11.7 % | non | non |
| v2-aucune-comparaison-de-test | seance-prevue-aujourdhui | 375 | x1.3 | 1034 px | 1201 px | +167 px | 16.2 % | non | non |
| v2-aucune-comparaison-de-test | seance-prevue-aujourdhui | 390 | x1 | 843 px | 941 px | +98 px | 11.6 % | non | non |
| v2-aucune-comparaison-de-test | seance-prevue-aujourdhui | 768 | x1 | 726 px | 804 px | +78 px | 10.7 % | oui | oui |
| v2-donnee-manquante | tendance-indisponible | 320 | x1 | 588 px | 614 px | +26 px | 4.4 % | non | non |
| v2-donnee-manquante | tendance-indisponible | 375 | x1 | 606 px | 634 px | +28 px | 4.6 % | oui | oui |
| v2-donnee-manquante | tendance-indisponible | 375 | x1.3 | 732 px | 785 px | +53 px | 7.2 % | non | non |
| v2-donnee-manquante | tendance-indisponible | 390 | x1 | 609 px | 619 px | +10 px | 1.6 % | oui | oui |
| v2-donnee-manquante | tendance-indisponible | 768 | x1 | 528 px | 558 px | +30 px | 5.7 % | oui | oui |

**Moyenne sur 35 comparaisons : +95.3 px (+15.6 %).** Ecrans qui tiennent sans defiler : 21 en variante 1, 17 en variante 2, sur 35.
