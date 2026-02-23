# FKS Training Load Model v2.0

## Vue d'ensemble

Le modèle de charge FKS est basé sur le **Performance Management Chart (PMC)** de Banister (1975), adapté pour les footballeurs amateurs et semi-professionnels.

## Concepts clés

### Les 3 métriques

| Métrique | Nom complet | Description |
|----------|-------------|-------------|
| **ATL** | Acute Training Load | Charge aiguë (fatigue récente). Réagit vite. |
| **CTL** | Chronic Training Load | Charge chronique (forme/fitness). Réagit lentement. |
| **TSB** | Training Stress Balance | Balance = CTL - ATL. Indique l'état de fraîcheur. |

### Interprétation du TSB

```
TSB > 0  → Plus de forme que de fatigue → "Frais"
TSB = 0  → Équilibre forme/fatigue → "Optimal"
TSB < 0  → Plus de fatigue que de forme → "Chargé"
```

## Zones TSB

| Zone | TSB | État | Action recommandée |
|------|-----|------|-------------------|
| **Surentraînement** | < -20 | Danger | Stop, récupération obligatoire |
| **Surcharge** | -20 à -10 | Attention | Réduire l'intensité |
| **Chargé** | -10 à -5 | Normal | Maintenir ou légère réduction |
| **Optimal** | -5 à +5 | Idéal | Zone de performance |
| **Frais** | +5 à +15 | Prêt | Idéal avant compétition |
| **Désentraîné** | > +15 | Perte | Reprendre l'entraînement |

## Formules mathématiques

### Mise à jour EWMA (Exponential Weighted Moving Average)

```
k = 1 - exp(-dt / τ)
nouvelle_valeur = ancienne_valeur + k × (charge_jour - ancienne_valeur)
```

Où :
- `dt` = nombre de jours depuis la dernière mise à jour
- `τ` (tau) = constante de temps

### Constantes de temps

| Métrique | Tau | Demi-vie | Signification |
|----------|-----|----------|---------------|
| ATL | 14 jours | ~10 jours | Fatigue décroît rapidement |
| CTL | 28 jours | ~19 jours | Forme persiste plus longtemps |

### Décroissance au repos

```
ATL_après_repos = ATL × exp(-jours_repos / 14)
CTL_après_repos = CTL × exp(-jours_repos / 28)
```

## Calcul de la charge journalière

### 1. Séances FKS (sRPE pondéré)

```
Charge = RPE × Durée(min) × Poids_Modalité × Multiplicateur_Feedback
```

#### Poids par modalité

| Modalité | Poids | Raison |
|----------|-------|--------|
| Mobilité | 0.3 | Très faible impact |
| Core | 0.6 | Impact modéré |
| Strength | 0.9 | Haute tension mais récupération rapide |
| Run | 1.0 | Référence |
| Circuit | 1.1 | Combinaison cardio + muscu |
| COD | 1.15 | Changements de direction = stress articulaire |
| Speed | 1.25 | Haute intensité neuromusculaire |
| Plyo | 1.3 | Maximum stress mécanique |

#### Multiplicateur feedback

| Condition | Multiplicateur |
|-----------|---------------|
| Fatigue ≥ 4 | × 1.15 |
| Fatigue ≤ 2 | × 0.90 |
| Sommeil ≤ 2 | × 1.10 |
| Sommeil ≥ 4 | × 0.95 |
| Douleur ≥ 4 | × 1.25 |
| Douleur = 3 | × 1.10 |
| Douleur ≤ 2 | × 0.95 |

Bornes globales : 0.8 à 1.4

### 2. Charges externes

```
Charge_externe = RPE × Durée(min) × Poids_Source
```

| Source | Poids | Justification |
|--------|-------|---------------|
| Match | 0.80 | Haute intensité, impact mental |
| Club | 0.70 | Variable selon le coach |
| Autre | 0.60 | Cross-training, etc. |

### 3. Caps de protection (soft-caps via tanh)

```
charge_cappée = cap × tanh(charge_brute / cap)
```

| Type | Cap |
|------|-----|
| Séances FKS | 180 |
| Externe | 230 |
| Total jour | 320 |

### 4. Guards de protection

Réduction automatique de la charge les jours sensibles :

| Contexte | Facteur | Réduction |
|----------|---------|-----------|
| Jour de match | 0.60 | -40% |
| Veille de match | 0.80 | -20% |
| Jour de club | 0.75 | -25% |
| Veille de club | 0.90 | -10% |

## Simulation type

### Joueur qui s'entraîne régulièrement

```
Semaine type :
- Lun : Club (RPE 6, 90min) → charge ~170
- Mar : Repos → decay
- Mer : FKS Force (RPE 7, 45min) + Club → charge ~200
- Jeu : Repos → decay
- Ven : FKS Explosivité (RPE 8, 40min) → charge ~150
- Sam : Match (RPE 8, 90min) → charge ~220
- Dim : Repos / Récup → decay

Évolution attendue :
- Début semaine : TSB ≈ +2 à +5
- Mi-semaine : TSB ≈ -3 à -5
- Fin semaine (post-match) : TSB ≈ -6 à -8
- Après récup : TSB remonte vers 0
```

### Après 4 semaines régulières

```
CTL stabilise autour de 45-55
ATL oscille entre 40-60 selon le jour
TSB varie de -8 (post-charge) à +3 (repos)
```

## Valeurs initiales (onboarding)

| Paramètre | Valeur | Raison |
|-----------|--------|--------|
| CTL0 | 15 | Joueur "moyennement entraîné" |
| ATL0 | 12 | Légèrement moins que CTL |
| TSB initial | +3 | Démarre légèrement frais |
| TSB floor onboarding | -10 | Protection 3 premières séances |

## Références scientifiques

1. **Banister, E.W. (1975)** - Modèle original Impulse-Response
2. **Foster, C. (1998)** - sRPE (session-RPE) pour quantifier la charge
3. **Impellizzeri, F.M. (2004)** - Validation du sRPE en football
4. **Gabbett, T.J. (2016)** - Acute:Chronic Workload Ratio (ACWR)

## Notes techniques

### Pourquoi tau = 14/28 au lieu de 7/42 ?

Le ratio 14/28 (2:1) au lieu du classique 7/42 (1:6) est choisi pour :
1. **Public amateur** : récupération plus lente que les pros
2. **Éviter les pics TSB** : forme plus réactive aux changements
3. **Stabilité** : moins de fluctuations violentes

### Pourquoi des soft-caps (tanh) ?

La fonction `tanh` permet :
- Pas de coupure brutale
- Plus la charge est haute, plus elle est "compressée"
- Charge de 1000 → ~300 (pas infini)

### Guard progressif

Le guard "veille" est plus léger que le guard "jour même" pour :
- Ne pas trop pénaliser les semaines chargées
- Permettre une préparation légère la veille
- Éviter que le joueur soit toujours "frais" artificiellement

---

*Dernière mise à jour : Février 2026*
*Version du modèle : 2.0*
