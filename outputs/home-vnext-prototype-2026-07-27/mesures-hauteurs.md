# Hauteur de page — Home actuel contre proposition vNext

Donnees FICTIVES. Mesure faite dans un vrai moteur de rendu (Chrome sans interface),
sur la vue « page entiere » (rien n'est coupe), marges de safe area comprises.
Meme moteur, meme feuille de style, meme methode des deux cotes.

Genere par `node prototype/home-vnext/verifier.js`.

| Etat | Largeur | Home actuel | vNext | Ecart px | Ecart % | Blocs actuel -> vNext |
|---|---:|---:|---:|---:|---:|---:|
| nouveau-joueur | 320 | 1204 px | 359 px | -845 | -70.2 % | 7 -> 3 |
| nouveau-joueur | 375 | 1177 px | 399 px | -778 | -66.1 % | 7 -> 3 |
| nouveau-joueur | 390 | 1163 px | 402 px | -761 | -65.4 % | 7 -> 3 |
| nouveau-joueur | 768 | 1100 px | 323 px | -777 | -70.6 % | 7 -> 3 |
| seance-prevue-aujourdhui | 320 | 1174 px | 811 px | -363 | -30.9 % | 8 -> 6 |
| seance-prevue-aujourdhui | 375 | 1108 px | 833 px | -275 | -24.8 % | 8 -> 6 |
| seance-prevue-aujourdhui | 390 | 1111 px | 836 px | -275 | -24.8 % | 8 -> 6 |
| seance-prevue-aujourdhui | 768 | 1065 px | 723 px | -342 | -32.1 % | 8 -> 6 |
| seance-a-reprendre | 320 | 1174 px | 793 px | -381 | -32.5 % | 8 -> 6 |
| seance-a-reprendre | 375 | 1108 px | 815 px | -293 | -26.4 % | 8 -> 6 |
| seance-a-reprendre | 390 | 1111 px | 818 px | -293 | -26.4 % | 8 -> 6 |
| seance-a-reprendre | 768 | 1065 px | 723 px | -342 | -32.1 % | 8 -> 6 |
| seance-terminee | 320 | 1262 px | 645 px | -617 | -48.9 % | 8 -> 5 |
| seance-terminee | 375 | 1233 px | 669 px | -564 | -45.7 % | 8 -> 5 |
| seance-terminee | 390 | 1236 px | 672 px | -564 | -45.6 % | 8 -> 5 |
| seance-terminee | 768 | 1153 px | 595 px | -558 | -48.4 % | 8 -> 5 |
| jour-recuperation | 320 | 1297 px | 809 px | -488 | -37.6 % | 8 -> 6 |
| jour-recuperation | 375 | 1249 px | 833 px | -416 | -33.3 % | 8 -> 6 |
| jour-recuperation | 390 | 1252 px | 836 px | -416 | -33.2 % | 8 -> 6 |
| jour-recuperation | 768 | 1172 px | 723 px | -449 | -38.3 % | 8 -> 6 |
| jour-sans-seance | 320 | 1277 px | 673 px | -604 | -47.3 % | 8 -> 5 |
| jour-sans-seance | 375 | 1213 px | 697 px | -516 | -42.5 % | 8 -> 5 |
| jour-sans-seance | 390 | 1216 px | 700 px | -516 | -42.4 % | 8 -> 5 |
| jour-sans-seance | 768 | 1153 px | 623 px | -530 | -46 % | 8 -> 5 |
| reprise-longue-interruption | 320 | 1241 px | 500 px | -741 | -59.7 % | 8 -> 4 |
| reprise-longue-interruption | 375 | 1230 px | 536 px | -694 | -56.4 % | 8 -> 4 |
| reprise-longue-interruption | 390 | 1216 px | 521 px | -695 | -57.2 % | 8 -> 4 |
| reprise-longue-interruption | 768 | 1153 px | 442 px | -711 | -61.7 % | 8 -> 4 |
| tendance-indisponible | 320 | 1257 px | 563 px | -694 | -55.2 % | 8 -> 4 |
| tendance-indisponible | 375 | 1230 px | 603 px | -627 | -51 % | 8 -> 4 |
| tendance-indisponible | 390 | 1216 px | 606 px | -610 | -50.2 % | 8 -> 4 |
| tendance-indisponible | 768 | 1153 px | 527 px | -626 | -54.3 % | 8 -> 4 |
| tendance-disponible | 320 | 1167 px | 643 px | -524 | -44.9 % | 7 -> 5 |
| tendance-disponible | 375 | 1103 px | 667 px | -436 | -39.5 % | 7 -> 5 |
| tendance-disponible | 390 | 1106 px | 670 px | -436 | -39.4 % | 7 -> 5 |
| tendance-disponible | 768 | 1043 px | 593 px | -450 | -43.1 % | 7 -> 5 |
| erreur-generation | 320 | 1220 px | 643 px | -577 | -47.3 % | 8 -> 5 |
| erreur-generation | 375 | 1176 px | 667 px | -509 | -43.3 % | 8 -> 5 |
| erreur-generation | 390 | 1179 px | 670 px | -509 | -43.2 % | 8 -> 5 |
| erreur-generation | 768 | 1096 px | 593 px | -503 | -45.9 % | 8 -> 5 |
| hors-ligne | 320 | 1259 px | 849 px | -410 | -32.6 % | 8 -> 7 |
| hors-ligne | 375 | 1196 px | 889 px | -307 | -25.7 % | 8 -> 7 |
| hors-ligne | 390 | 1199 px | 892 px | -307 | -25.6 % | 8 -> 7 |
| hors-ligne | 768 | 1116 px | 781 px | -335 | -30 % | 8 -> 7 |
| directive-club-absente | 320 | 1174 px | 777 px | -397 | -33.8 % | 8 -> 6 |
| directive-club-absente | 375 | 1108 px | 817 px | -291 | -26.3 % | 8 -> 6 |
| directive-club-absente | 390 | 1111 px | 820 px | -291 | -26.2 % | 8 -> 6 |
| directive-club-absente | 768 | 1065 px | 723 px | -342 | -32.1 % | 8 -> 6 |
| directive-club-non-appliquee | 320 | 1174 px | 777 px | -397 | -33.8 % | 8 -> 6 |
| directive-club-non-appliquee | 375 | 1108 px | 817 px | -291 | -26.3 % | 8 -> 6 |
| directive-club-non-appliquee | 390 | 1111 px | 820 px | -291 | -26.2 % | 8 -> 6 |
| directive-club-non-appliquee | 768 | 1065 px | 723 px | -342 | -32.1 % | 8 -> 6 |
| joueur-autonome-sans-club | 320 | 1174 px | 777 px | -397 | -33.8 % | 8 -> 6 |
| joueur-autonome-sans-club | 375 | 1108 px | 817 px | -291 | -26.3 % | 8 -> 6 |
| joueur-autonome-sans-club | 390 | 1111 px | 820 px | -291 | -26.2 % | 8 -> 6 |
| joueur-autonome-sans-club | 768 | 1065 px | 723 px | -342 | -32.1 % | 8 -> 6 |
| stress-textes-longs | 320 | 1299 px | 833 px | -466 | -35.9 % | 8 -> 6 |
| stress-textes-longs | 375 | 1267 px | 873 px | -394 | -31.1 % | 8 -> 6 |
| stress-textes-longs | 390 | 1254 px | 876 px | -378 | -30.1 % | 8 -> 6 |
| stress-textes-longs | 768 | 1116 px | 781 px | -335 | -30 % | 8 -> 6 |

**Moyenne sur les 60 comparaisons possibles : -40.2 % de hauteur de page.** Blocs de premier niveau : 7.9 en moyenne aujourd'hui, 5.3 dans la proposition.

Ecrans qui tiennent SANS DEFILER : 31 sur 60 pour la proposition, 0 sur 60 pour le Home actuel.
