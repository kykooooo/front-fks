# Hauteurs mesurees — l'ecran du nouveau joueur

Hauteur totale de la page, marges de safe area comprises, mesuree dans un vrai moteur de rendu (Chrome sans interface). `jsdom` n'a aucun moteur de mise en page : toute hauteur y vaut 0, et une hauteur relevee la-bas serait un mensonge.

La colonne **Aujourd'hui** est l'ecran actuel du prototype — celui qui a declenche la decision du 03/08. Les deux autres sont les propositions.

| Largeur | Texte | Zone visible | Aujourd'hui | V-A — Première mission | V-B — Anticipation honnête |
|---|---|---|---|---|---|
| 320 px | normal | 519 px | **363 px** | **597 px** ⚠ defile | **580 px** ⚠ defile |
| 375 px | normal | 729 px | **401 px** | **615 px** | **598 px** |
| 375 px | x1,3 | 729 px | **475 px** | **778 px** ⚠ defile | **764 px** ⚠ defile |
| 390 px | normal | 761 px | **404 px** | **618 px** | **601 px** |
| 768 px | normal | 975 px | **323 px** | **497 px** | **480 px** |

## Comment lire la colonne « zone visible »

C'est ce que le joueur voit sans defiler : hauteur d'ecran moins la barre d'onglets (49 pt) et l'inset bas. Une hauteur superieure ne veut pas dire « trop long » — elle veut dire qu'il faut defiler pour atteindre la fin, ce qui est acceptable si ce qui passe dessous n'est pas necessaire pour agir aujourd'hui.

Les insets sont les valeurs iOS publiees par appareil (`lib/devices.js`), pas des mesures prises sur un telephone reel. A confirmer en recette telephone.
