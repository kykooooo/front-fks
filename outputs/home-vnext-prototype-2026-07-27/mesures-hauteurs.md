# Hauteur de page — Home actuel contre proposition vNext

Donnees FICTIVES. Mesure faite dans un vrai moteur de rendu (Chrome sans interface),
sur la vue « page entiere » (rien n'est coupe), marges de safe area comprises.
Meme moteur, meme feuille de style, meme methode des deux cotes.

Genere par `node prototype/home-vnext/verifier.js`.

| Etat | Largeur | Home actuel | vNext | Ecart px | Ecart % | Blocs actuel -> vNext |
|---|---:|---:|---:|---:|---:|---:|
| nouveau-joueur | 320 | 1204 px | 363 px | -841 | -69.9 % | 7 -> 3 |
| nouveau-joueur | 375 | 1177 px | 401 px | -776 | -65.9 % | 7 -> 3 |
| nouveau-joueur | 390 | 1163 px | 404 px | -759 | -65.3 % | 7 -> 3 |
| nouveau-joueur | 768 | 1100 px | 323 px | -777 | -70.6 % | 7 -> 3 |
| seance-prevue-aujourdhui | 320 | 1174 px | 842 px | -332 | -28.3 % | 8 -> 6 |
| seance-prevue-aujourdhui | 375 | 1108 px | 840 px | -268 | -24.2 % | 8 -> 6 |
| seance-prevue-aujourdhui | 390 | 1111 px | 843 px | -268 | -24.1 % | 8 -> 6 |
| seance-prevue-aujourdhui | 768 | 1065 px | 726 px | -339 | -31.8 % | 8 -> 6 |
| seance-a-reprendre | 320 | 1174 px | 822 px | -352 | -30 % | 8 -> 6 |
| seance-a-reprendre | 375 | 1108 px | 820 px | -288 | -26 % | 8 -> 6 |
| seance-a-reprendre | 390 | 1111 px | 823 px | -288 | -25.9 % | 8 -> 6 |
| seance-a-reprendre | 768 | 1065 px | 726 px | -339 | -31.8 % | 8 -> 6 |
| seance-terminee | 320 | 1262 px | 646 px | -616 | -48.8 % | 8 -> 5 |
| seance-terminee | 375 | 1233 px | 668 px | -565 | -45.8 % | 8 -> 5 |
| seance-terminee | 390 | 1236 px | 671 px | -565 | -45.7 % | 8 -> 5 |
| seance-terminee | 768 | 1153 px | 594 px | -559 | -48.5 % | 8 -> 5 |
| jour-recuperation | 320 | 1297 px | 838 px | -459 | -35.4 % | 8 -> 6 |
| jour-recuperation | 375 | 1249 px | 840 px | -409 | -32.7 % | 8 -> 6 |
| jour-recuperation | 390 | 1252 px | 843 px | -409 | -32.7 % | 8 -> 6 |
| jour-recuperation | 768 | 1172 px | 726 px | -446 | -38.1 % | 8 -> 6 |
| jour-sans-seance | 320 | 1277 px | 676 px | -601 | -47.1 % | 8 -> 5 |
| jour-sans-seance | 375 | 1213 px | 698 px | -515 | -42.5 % | 8 -> 5 |
| jour-sans-seance | 390 | 1216 px | 701 px | -515 | -42.4 % | 8 -> 5 |
| jour-sans-seance | 768 | 1153 px | 624 px | -529 | -45.9 % | 8 -> 5 |
| reprise-longue-interruption | 320 | 1241 px | 482 px | -759 | -61.2 % | 8 -> 4 |
| reprise-longue-interruption | 375 | 1230 px | 540 px | -690 | -56.1 % | 8 -> 4 |
| reprise-longue-interruption | 390 | 1216 px | 543 px | -673 | -55.3 % | 8 -> 4 |
| reprise-longue-interruption | 768 | 1153 px | 442 px | -711 | -61.7 % | 8 -> 4 |
| tendance-indisponible | 320 | 1257 px | 588 px | -669 | -53.2 % | 8 -> 4 |
| tendance-indisponible | 375 | 1230 px | 606 px | -624 | -50.7 % | 8 -> 4 |
| tendance-indisponible | 390 | 1216 px | 609 px | -607 | -49.9 % | 8 -> 4 |
| tendance-indisponible | 768 | 1153 px | 528 px | -625 | -54.2 % | 8 -> 4 |
| tendance-disponible | 320 | 1167 px | 644 px | -523 | -44.8 % | 7 -> 5 |
| tendance-disponible | 375 | 1103 px | 666 px | -437 | -39.6 % | 7 -> 5 |
| tendance-disponible | 390 | 1106 px | 669 px | -437 | -39.5 % | 7 -> 5 |
| tendance-disponible | 768 | 1043 px | 592 px | -451 | -43.2 % | 7 -> 5 |
| erreur-generation | 320 | 1220 px | 644 px | -576 | -47.2 % | 8 -> 5 |
| erreur-generation | 375 | 1176 px | 666 px | -510 | -43.4 % | 8 -> 5 |
| erreur-generation | 390 | 1179 px | 669 px | -510 | -43.3 % | 8 -> 5 |
| erreur-generation | 768 | 1096 px | 592 px | -504 | -46 % | 8 -> 5 |
| hors-ligne | 320 | 1259 px | 876 px | -383 | -30.4 % | 8 -> 7 |
| hors-ligne | 375 | 1196 px | 894 px | -302 | -25.3 % | 8 -> 7 |
| hors-ligne | 390 | 1199 px | 897 px | -302 | -25.2 % | 8 -> 7 |
| hors-ligne | 768 | 1116 px | 784 px | -332 | -29.7 % | 8 -> 7 |
| directive-club-absente | 320 | 1174 px | 806 px | -368 | -31.3 % | 8 -> 6 |
| directive-club-absente | 375 | 1108 px | 824 px | -284 | -25.6 % | 8 -> 6 |
| directive-club-absente | 390 | 1111 px | 827 px | -284 | -25.6 % | 8 -> 6 |
| directive-club-absente | 768 | 1065 px | 726 px | -339 | -31.8 % | 8 -> 6 |
| directive-club-non-appliquee | 320 | 1174 px | 806 px | -368 | -31.3 % | 8 -> 6 |
| directive-club-non-appliquee | 375 | 1108 px | 824 px | -284 | -25.6 % | 8 -> 6 |
| directive-club-non-appliquee | 390 | 1111 px | 827 px | -284 | -25.6 % | 8 -> 6 |
| directive-club-non-appliquee | 768 | 1065 px | 726 px | -339 | -31.8 % | 8 -> 6 |
| joueur-autonome-sans-club | 320 | 1174 px | 826 px | -348 | -29.6 % | 8 -> 6 |
| joueur-autonome-sans-club | 375 | 1108 px | 824 px | -284 | -25.6 % | 8 -> 6 |
| joueur-autonome-sans-club | 390 | 1111 px | 827 px | -284 | -25.6 % | 8 -> 6 |
| joueur-autonome-sans-club | 768 | 1065 px | 726 px | -339 | -31.8 % | 8 -> 6 |
| stress-textes-longs | 320 | 1299 px | 848 px | -451 | -34.7 % | 8 -> 6 |
| stress-textes-longs | 375 | 1267 px | 886 px | -381 | -30.1 % | 8 -> 6 |
| stress-textes-longs | 390 | 1254 px | 889 px | -365 | -29.1 % | 8 -> 6 |
| stress-textes-longs | 768 | 1116 px | 792 px | -324 | -29 % | 8 -> 6 |

**Moyenne sur les 60 comparaisons possibles : -39.6 % de hauteur de page.** Blocs de premier niveau : 7.9 en moyenne aujourd'hui, 5.3 dans la proposition.

Ecrans qui tiennent SANS DEFILER : 31 sur 60 pour la proposition, 0 sur 60 pour le Home actuel.
