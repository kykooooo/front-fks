export type ExerciseInstruction = {
  howTo: string;
  cues: readonly string[];
  videoUrl?: string;
};

const T = {
  squatBar: {
    howTo: "Barre sur le haut du dos, pieds largeur epaules. Descends en controlant puis remonte en poussant dans le sol.",
    cues: ["Tronc gaine", "Genoux suivent les orteils", "Talons au sol"],
    videoUrl: "https://www.youtube.com/results?search_query=back+squat+technique",
  },
  frontSquat: {
    howTo: "Barre sur les clavicules, coudes hauts. Descends droit puis remonte fort.",
    cues: ["Coudes hauts", "Buste droit", "Talons au sol"],
    videoUrl: "https://www.youtube.com/results?search_query=front+squat+technique",
  },
  boxSquat: {
    howTo: "Assieds-toi controle sur la box, stop court, puis remonte.",
    cues: ["Controle en bas", "Tension constante", "Remontee explosive"],
  },
  pauseSquat: {
    howTo: "Descends en controle, marque une pause en bas, puis remonte.",
    cues: ["Pause stable", "Dos neutre", "Talons au sol"],
  },
  gobletSquat: {
    howTo: "Charge contre la poitrine, descends en ouvrant les hanches, remonte en poussant.",
    cues: ["Coude entre les genoux", "Tronc gaine", "Amplitude controlee"],
  },
  gobletBoxSquat: {
    howTo: "Charge contre la poitrine, touche la box puis remonte.",
    cues: ["Controle sur la box", "Tronc gaine", "Talons au sol"],
  },
  airSquatBox: {
    howTo: "Squat poids du corps jusqua la box, touche et remonte.",
    cues: ["Genoux alignes", "Dos neutre", "Mouvement fluide"],
  },
  spanishSquat: {
    howTo: "Sangle derriere les genoux, recule et tiens la position a 90 deg.",
    cues: ["Tension sur la sangle", "Dos droit", "Respiration lente"],
  },
  wallSit: {
    howTo: "Dos contre le mur, genoux a 90 deg, tiens la position.",
    cues: ["Bas du dos colle", "Poids sur les talons", "Respiration calme"],
  },
  legPress: {
    howTo: "Pieds sur la plateforme, descends en controle puis repousse sans verrouiller.",
    cues: ["Genoux suivent les orteils", "Amplitude confortable", "Bassin stable"],
  },
  hackSquat: {
    howTo: "Dos plaque, descends en controle puis pousse fort.",
    cues: ["Talons au sol", "Amplitude propre", "Pas de rebond"],
  },
  beltSquat: {
    howTo: "Harnais sur la taille, descends droit puis remonte.",
    cues: ["Dos droit", "Genoux stables", "Poussee uniforme"],
  },
  sitToStand: {
    howTo: "Assis sur un support, pieds sous les genoux, leve-toi sans elan.",
    cues: ["Poussee talons", "Buste gaine", "Controle en descente"],
  },
  trapBarDeadlift: {
    howTo: "Poignees trap bar, dos neutre, pousse le sol pour te lever.",
    cues: ["Dos neutre", "Hanches et epaules montent ensemble", "Verrouillage doux"],
    videoUrl: "https://www.youtube.com/results?search_query=trap+bar+deadlift+technique",
  },
  deadliftHeavy: {
    howTo: "Prise solide, dos neutre, pousse le sol et remonte la barre proche du corps.",
    cues: ["Barre proche", "Tronc gaine", "Hanches en premiere"],
  },
  rdl: {
    howTo: "Genoux legerement flechis, hanches en arriere, descends jusqua etirement puis remonte.",
    cues: ["Dos neutre", "Poids sur les talons", "Amplitude controlee"],
    videoUrl: "https://www.youtube.com/results?search_query=romanian+deadlift+technique",
  },
  goodMorning: {
    howTo: "Barre sur le dos, hinge des hanches, buste vers lavant puis remonte.",
    cues: ["Dos neutre", "Genoux fixes", "Mouvement lent"],
  },
  hipThrust: {
    howTo: "Epaules sur banc, pousse les hanches vers le haut puis redescends en controle.",
    cues: ["Rentre le menton", "Tension fessiers", "Haut du dos stable"],
  },
  hipThrustIso: {
    howTo: "Monte en hip thrust et tiens la position haute.",
    cues: ["Bassin neutre", "Fessiers contractes", "Respiration stable"],
  },
  gluteBridge: {
    howTo: "Allonge, pieds au sol, monte le bassin puis redescends.",
    cues: ["Poussee talons", "Bassin neutre", "Controle en bas"],
  },
  singleLegBridge: {
    howTo: "Un pied au sol, l autre jambe tendue, monte le bassin.",
    cues: ["Hanches alignees", "Poussee talon", "Controle du bassin"],
  },
  singleLegRdl: {
    howTo: "Pied d appui stable, hinge des hanches, remonte en controle.",
    cues: ["Dos neutre", "Hanches alignees", "Regard au sol"],
  },
  singleLegRdlReach: {
    howTo: "Hinge sur une jambe en allant chercher loin devant puis remonte.",
    cues: ["Equilibre", "Dos long", "Retour controle"],
  },
  cablePullThrough: {
    howTo: "Corde entre les jambes, recule les hanches puis pousse en avant.",
    cues: ["Dos neutre", "Hanches en arriere", "Fessiers actifs"],
  },
  backExtension: {
    howTo: "Banc a 45 deg, hinge des hanches puis remonte jusqua alignement.",
    cues: ["Bassin stable", "Dos neutre", "Mouvement lent"],
  },
  hamCurlMachine: {
    howTo: "Allonge sur la machine, plie les genoux en controle puis redescends.",
    cues: ["Hanches collees", "Amplitude propre", "Controle excentrique"],
  },
  hamCurlSwiss: {
    howTo: "Talons sur ballon, monte le bassin puis ramene les talons vers toi.",
    cues: ["Bassin haut", "Gainage actif", "Controle du retour"],
  },
  hamCurlSlider: {
    howTo: "Talons sur sliders, monte le bassin et tire les talons vers toi.",
    cues: ["Bassin haut", "Dos neutre", "Controle excentrique"],
  },
  splitSquat: {
    howTo: "Position fente, descends verticalement puis remonte.",
    cues: ["Tronc gaine", "Genou avant stable", "Poussee talon"],
  },
  bulgarianSplit: {
    howTo: "Pied arriere sur banc, descends controle puis remonte.",
    cues: ["Tronc droit", "Genou avant stable", "Amplitude propre"],
  },
  reverseLunge: {
    howTo: "Recule un pied, descends puis reviens.",
    cues: ["Genou avant stable", "Tronc droit", "Controle en bas"],
  },
  forwardLunge: {
    howTo: "Avance un pied, descends puis reviens.",
    cues: ["Genou avant stable", "Tronc droit", "Poussee talon"],
  },
  stepUp: {
    howTo: "Monte sur la box en poussant dans le talon, controle la descente.",
    cues: ["Genou stable", "Poussee talon", "Controle en bas"],
  },
  stepDown: {
    howTo: "Descends lentement de la box en controlant le genou.",
    cues: ["Controle excentrique", "Bassin stable", "Tronc gaine"],
  },
  lateralStepUp: {
    howTo: "Monte lateralement sur la box puis redescends controle.",
    cues: ["Genou stable", "Tronc droit", "Poussee talon"],
  },
  lateralStepDown: {
    howTo: "Descends lateralement de la box en controlant.",
    cues: ["Genou stable", "Controle en bas", "Bassin stable"],
  },
  singleLegBoxSquat: {
    howTo: "Assieds-toi sur la box sur une jambe puis remonte.",
    cues: ["Genou aligne", "Controle en bas", "Poussee talon"],
  },
  skaterSquat: {
    howTo: "Descends sur une jambe vers la box puis remonte.",
    cues: ["Genou aligne", "Tronc gaine", "Controle du mouvement"],
  },
  lateralLunge: {
    howTo: "Pas lateral, hanches en arriere, puis repousse.",
    cues: ["Pied a plat", "Genou aligne", "Buste droit"],
  },
  cossack: {
    howTo: "Descends lateralement sur une jambe, autre jambe tendue.",
    cues: ["Amplitude progressive", "Dos long", "Controle en bas"],
  },
  hipAirplane: {
    howTo: "Equilibre sur une jambe, ouvre et ferme les hanches lentement.",
    cues: ["Bassin stable", "Tronc gaine", "Mouvement lent"],
  },
  nordic: {
    howTo: "Genoux au sol, descends en controle vers lavant, remonte avec assistance.",
    cues: ["Tronc gaine", "Controle excentrique", "Amplitude propre"],
    videoUrl: "https://www.youtube.com/results?search_query=nordic+hamstring+curl+technique",
  },
  nordicAssisted: {
    howTo: "Version nordic avec assistance elastique pour controler la descente.",
    cues: ["Controle lent", "Tronc gaine", "Amplitude progressive"],
  },
  nordicEccentric: {
    howTo: "Descends en 3 secondes puis remonte avec assistance.",
    cues: ["Tempo lent", "Tronc gaine", "Controle total"],
  },
  razorCurl: {
    howTo: "Position nordic, remonte en tirant les hanches vers lavant.",
    cues: ["Controle lent", "Hanches alignees", "Tronc gaine"],
  },
  hamWalkout: {
    howTo: "Depuis un pont, marche les talons en avant puis reviens.",
    cues: ["Bassin haut", "Pas lents", "Gainage actif"],
  },
  copenhagen: {
    howTo: "Gainage lateral avec jambe en appui sur banc.",
    cues: ["Hanches hautes", "Tronc aligne", "Respiration controlee"],
    videoUrl: "https://www.youtube.com/results?search_query=copenhagen+plank+exercise",
  },
  copenhagenShort: {
    howTo: "Gainage lateral version levier court.",
    cues: ["Hanches hautes", "Controle", "Respiration"],
  },
  adductorSlide: {
    howTo: "Jambe sur slider, ouvre en lateral puis ramene.",
    cues: ["Tronc gaine", "Controle lent", "Amplitude propre"],
  },
  adductorSqueeze: {
    howTo: "Allonge, serre un ballon entre les genoux, tiens la pression.",
    cues: ["Respiration lente", "Tension constante", "Bassin stable"],
  },
  benchPress: {
    howTo: "Pieds au sol, omoplates serrees, barre descend controle puis remonte.",
    cues: ["Poignets droits", "Barre sur la poitrine", "Tronc gaine"],
    videoUrl: "https://www.youtube.com/results?search_query=bench+press+technique",
  },
  dumbbellPress: {
    howTo: "Halteres au-dessus du torse, descends controle puis remonte.",
    cues: ["Coudes a 45 deg", "Omoplates serrees", "Controle en bas"],
  },
  inclineDbPress: {
    howTo: "Banc incline, descends les halteres puis remonte.",
    cues: ["Omoplates serrees", "Coudes a 45 deg", "Controle"],
  },
  pushup: {
    howTo: "Corps gaine, descends jusqua pres du sol puis remonte.",
    cues: ["Ligne droite", "Coudes a 45 deg", "Gainage actif"],
  },
  pushupFeetElevated: {
    howTo: "Pieds sur support, descends controle puis remonte.",
    cues: ["Gainage fort", "Coudes a 45 deg", "Amplitude propre"],
  },
  inclinePushup: {
    howTo: "Mains sur support, descends controle puis remonte.",
    cues: ["Corps gaine", "Coudes a 45 deg", "Amplitude propre"],
  },
  landminePress: {
    howTo: "Barre en angle, presse vers lavant et le haut.",
    cues: ["Tronc gaine", "Trajectoire stable", "Controle"],
  },
  ohPress: {
    howTo: "Presse au-dessus de la tete en gardant le tronc gaine.",
    cues: ["Fessiers actifs", "Coudes sous la barre", "Respiration"],
  },
  floorPress: {
    howTo: "Allonge au sol, descends les halteres jusquau sol puis remonte.",
    cues: ["Poignets droits", "Coudes a 45 deg", "Controle"],
  },
  machinePress: {
    howTo: "Ajuste la machine, pousse controle puis reviens.",
    cues: ["Dos colle", "Amplitude propre", "Pas de rebond"],
  },
  fastPushup: {
    howTo: "Pompes explosives, monte rapidement, controle la descente.",
    cues: ["Gainage", "Qualite avant vitesse", "Atterrissage doux"],
  },
  handReleasePushup: {
    howTo: "Descends au sol, relache les mains, puis remonte.",
    cues: ["Corps gaine", "Amplitude complete", "Controle"],
  },
  inclineFastPushup: {
    howTo: "Pompes explosives avec mains sur support.",
    cues: ["Gainage", "Vitesse controlee", "Amplitude propre"],
  },
  rowBar: {
    howTo: "Buste incline, tire la barre vers le ventre puis redescends.",
    cues: ["Dos neutre", "Coudes proches", "Controle"],
  },
  oneArmRow: {
    howTo: "Un genou sur banc, tire l haltere vers la hanche.",
    cues: ["Dos neutre", "Coude proche", "Controle"],
  },
  invertedRow: {
    howTo: "Corps gaine sous une barre, tire la poitrine vers la barre.",
    cues: ["Corps droit", "Omoplates serrees", "Controle"],
  },
  pullup: {
    howTo: "Suspendu, tire la poitrine vers la barre puis redescends.",
    cues: ["Epaules basses", "Gainage", "Amplitude propre"],
  },
  bandRow: {
    howTo: "Assis ou debout, tire l elastique vers toi.",
    cues: ["Dos neutre", "Omoplates serrees", "Controle"],
  },
  tableRow: {
    howTo: "Sous une table solide, tire la poitrine vers le bord.",
    cues: ["Corps gaine", "Controle", "Amplitude propre"],
  },
  latPulldown: {
    howTo: "Tire la barre vers le haut de la poitrine puis remonte controle.",
    cues: ["Epaules basses", "Buste stable", "Controle"],
  },
  chestSupportedRow: {
    howTo: "Buste sur banc incline, tire les halteres vers la poitrine.",
    cues: ["Omoplates serrees", "Controle", "Pas d elan"],
  },
  cableRow: {
    howTo: "Tire la poignee vers le ventre, puis relache controle.",
    cues: ["Dos droit", "Omoplates serrees", "Controle"],
  },
  trxRow: {
    howTo: "Corps incline, tire les poignets vers les cotes.",
    cues: ["Corps gaine", "Controle", "Amplitude propre"],
  },
  pullupAssisted: {
    howTo: "Traction avec assistance elastique ou machine.",
    cues: ["Epaules basses", "Gainage", "Controle"],
  },
  facePull: {
    howTo: "Tire la corde vers le visage, coudes hauts.",
    cues: ["Omoplates serrees", "Coude haut", "Controle"],
  },
  bandPullApart: {
    howTo: "Ecarte l elastique bras tendus, puis reviens controle.",
    cues: ["Epaules basses", "Omoplates serrees", "Controle"],
  },
  ytwRaise: {
    howTo: "Leve les bras en Y, T, W avec controle.",
    cues: ["Epaules basses", "Mouvement lent", "Posture stable"],
  },
  proneYtw: {
    howTo: "Allonge sur ventre, leve bras en Y, T, W.",
    cues: ["Cou nu long", "Controle", "Omoplates serrees"],
  },
  scapPushup: {
    howTo: "Pompe scapulaire, sans plier les coudes.",
    cues: ["Epaules loin des oreilles", "Amplitude courte", "Controle"],
  },
  wallSlide: {
    howTo: "Dos au mur, glisse les bras vers le haut puis redescends.",
    cues: ["Cotes rentrees", "Mains contre mur", "Controle"],
  },
  bandExternalRotation: {
    howTo: "Coude colle au corps, tourne la main vers l exterieur.",
    cues: ["Coude fixe", "Mouvement lent", "Controle"],
  },
  serratusPunch: {
    howTo: "Bras tendu, pousse legerement vers lavant pour activer le serratus.",
    cues: ["Epaules basses", "Petit mouvement", "Controle"],
  },
  proneTRaise: {
    howTo: "Allonge sur ventre, leve les bras en T.",
    cues: ["Omoplates serrees", "Cou long", "Controle"],
  },
  deadHang: {
    howTo: "Suspendu a la barre, epaules basses, tiens.",
    cues: ["Gainage", "Respiration lente", "Epaules basses"],
  },
  scapularPullup: {
    howTo: "Suspendu, monte et descend seulement les omoplates.",
    cues: ["Amplitude courte", "Controle", "Epaules basses"],
  },
  lowTrapRaise: {
    howTo: "Leve les bras en diagonal pour activer les trap bas.",
    cues: ["Mouvement lent", "Omoplates basses", "Controle"],
  },
  bandW: {
    howTo: "Elastique, fais un W avec les bras puis reviens.",
    cues: ["Epaules basses", "Controle", "Posture droite"],
  },
  proneCobra: {
    howTo: "Allonge sur ventre, leve le torse legerement et serre les omoplates.",
    cues: ["Cou long", "Tension douce", "Respiration"],
  },
  wallAngels: {
    howTo: "Dos au mur, glisse les bras en gardant les mains contre le mur.",
    cues: ["Cotes rentrees", "Controle", "Posture droite"],
  },
  calfRaise: {
    howTo: "Monter sur la pointe des pieds puis redescendre controle.",
    cues: ["Amplitude complete", "Controle lent", "Chevilles stables"],
  },
  calfRaiseBent: {
    howTo: "Genoux legerement flechis, monte sur la pointe puis redescends.",
    cues: ["Amplitude complete", "Controle lent", "Chevilles stables"],
  },
  calfRaiseSingle: {
    howTo: "Sur une jambe, monte sur la pointe puis redescends.",
    cues: ["Controle", "Bassin stable", "Amplitude complete"],
  },
  tibRaise: {
    howTo: "Dos au mur, leve les pointes de pied vers toi.",
    cues: ["Controle lent", "Amplitude propre", "Chevilles stables"],
  },
  ankleDorsiflexion: {
    howTo: "Elastique sur le pied, ramene la pointe vers toi.",
    cues: ["Controle lent", "Mouvement propre", "Cheville stable"],
  },
  toeWalks: {
    howTo: "Marche sur les pointes de pieds.",
    cues: ["Posture droite", "Petits pas", "Controle"],
  },
  heelWalks: {
    howTo: "Marche sur les talons, pointes levees.",
    cues: ["Posture droite", "Controle", "Pas courts"],
  },
  inversionEversion: {
    howTo: "Elastique autour du pied, tourne vers interieur puis exterieur.",
    cues: ["Controle lent", "Cheville stable", "Amplitude propre"],
  },
  balanceReach: {
    howTo: "Equilibre sur une jambe, touche le sol devant ou sur les cotes.",
    cues: ["Bassin stable", "Genou aligne", "Controle"],
  },
  sideShuffleBand: {
    howTo: "Elastique aux genoux, pas lateraux controles.",
    cues: ["Genoux ouverts", "Bassin bas", "Pas courts"],
  },
  seatedCalfRaise: {
    howTo: "Assis, monte sur la pointe puis redescends.",
    cues: ["Amplitude complete", "Controle", "Pas de rebond"],
  },
  soleusIsoWall: {
    howTo: "Genoux flechis, tiens la position sur la pointe.",
    cues: ["Tension constante", "Bassin stable", "Respiration"],
  },
  soleusIsoSingle: {
    howTo: "Sur une jambe, genou flechi, tiens sur la pointe.",
    cues: ["Tension constante", "Controle", "Bassin stable"],
  },
  jumpRopeEasy: {
    howTo: "Petits sauts, rythme regulier.",
    cues: ["Contacts courts", "Epaules relachees", "Posture droite"],
  },
  pogoHopsLow: {
    howTo: "Petits rebonds sur l avant du pied.",
    cues: ["Contacts courts", "Genoux souples", "Chevilles actives"],
  },
  shortFoot: {
    howTo: "Rapproche les metatarses sans plier les orteils.",
    cues: ["Mouvement petit", "Controle", "Voute active"],
  },
  toeYoga: {
    howTo: "Leve le gros orteil puis les autres, en alternant.",
    cues: ["Mouvement lent", "Controle", "Cheville stable"],
  },
  lateralBandWalk: {
    howTo: "Elastique aux genoux, pas lateraux lents.",
    cues: ["Genoux ouverts", "Bassin bas", "Controle"],
  },
  monsterWalk: {
    howTo: "Elastique aux genoux, pas en diagonale.",
    cues: ["Tronc gaine", "Genoux ouverts", "Pas controles"],
  },
  sidePlankHipAbduction: {
    howTo: "Gainage lateral, leve la jambe du dessus.",
    cues: ["Hanches hautes", "Controle", "Respiration"],
  },
  plank: {
    howTo: "Corps droit, appui sur avant-bras, tiens la position.",
    cues: ["Bassin neutre", "Abdos serres", "Respiration lente"],
  },
  sidePlank: {
    howTo: "Gainage sur le cote, hanches hautes.",
    cues: ["Alignement tete-bassin", "Controle", "Respiration"],
  },
  pallof: {
    howTo: "Elastique sur le cote, tends les bras devant toi et tiens.",
    cues: ["Bassin stable", "Controle", "Respiration"],
  },
  deadbug: {
    howTo: "Allonge, bras et jambes alternes, bas du dos colle.",
    cues: ["Dos colle", "Mouvement lent", "Respiration"],
  },
  rkcPlank: {
    howTo: "Planche avec tension maximale, contraction globale.",
    cues: ["Serre fessiers", "Serre abdos", "Respiration courte"],
  },
  birdDog: {
    howTo: "A quatre pattes, tends bras et jambe opposes.",
    cues: ["Bassin stable", "Mouvement lent", "Dos neutre"],
  },
  suitcaseCarry: {
    howTo: "Marche avec une charge d un cote, tronc droit.",
    cues: ["Bassin stable", "Epaules basses", "Pas reguliers"],
  },
  farmerCarry: {
    howTo: "Marche avec deux charges, posture droite.",
    cues: ["Tronc gaine", "Epaules basses", "Pas reguliers"],
  },
  bandChop: {
    howTo: "Elastique en hauteur, tire en diagonale vers la hanche.",
    cues: ["Tronc stable", "Rotation controlee", "Respiration"],
  },
  pallofIsoMarch: {
    howTo: "Pallof, puis leve un genou a la fois.",
    cues: ["Bassin stable", "Controle", "Respiration"],
  },
  hollowHold: {
    howTo: "Allonge, decolle epaules et jambes, tiens la position.",
    cues: ["Bas du dos colle", "Tension constante", "Respiration"],
  },
  plankShoulderTaps: {
    howTo: "Planche, touche une epaule puis l autre.",
    cues: ["Bassin stable", "Controle", "Pas de rotation"],
  },
  stirThePot: {
    howTo: "Avant-bras sur ballon, fais de petits cercles.",
    cues: ["Bassin stable", "Controle", "Respiration"],
  },
  halfKneelingPallof: {
    howTo: "Pallof en position demi-genou, tiens la tension.",
    cues: ["Bassin stable", "Tronc droit", "Respiration"],
  },
  deadbugBand: {
    howTo: "Deadbug avec elastique, mouvements lents.",
    cues: ["Dos colle", "Controle", "Respiration"],
  },
  mobilityHips: {
    howTo: "Mouvements lents de hanches, amplitude progressive.",
    cues: ["Respiration lente", "Amplitude confortable", "Pas de douleur"],
  },
  mobilityAnkle: {
    howTo: "Dorsiflexion douce contre un mur ou avec appui.",
    cues: ["Controle", "Amplitude progressive", "Sans douleur"],
  },
  mobilityTspine: {
    howTo: "Rotations thoraciques lentes, buste long.",
    cues: ["Respiration", "Amplitude progressive", "Sans douleur"],
  },
  mobilityShoulder: {
    howTo: "Cercles et mobilite douce des epaules.",
    cues: ["Amplitude progressive", "Sans douleur", "Respiration"],
  },
  circuitLow: {
    howTo: "Enchaine plusieurs exos poids du corps avec pauses courtes.",
    cues: ["Rythme regulier", "Technique propre", "Respiration"],
  },
  circuitMod: {
    howTo: "Alternance cardio et force, intensite moderee.",
    cues: ["Rythme stable", "Controle", "Hydratation"],
  },
  circuitHi: {
    howTo: "Enchainement intense, temps de repos court.",
    cues: ["Qualite avant vitesse", "Respiration", "Controle"],
  },
  codCones: {
    howTo: "Slalom ou virages autour de plots, vitesse moderee.",
    cues: ["Appuis courts", "Genoux bas", "Regard loin"],
  },
  tDrill: {
    howTo: "Sprint, pas lateraux, retour en arriere selon le T.",
    cues: ["Freinage propre", "Buste stable", "Regard haut"],
  },
  cod505: {
    howTo: "Sprint, freinage a 5m, relance inverse.",
    cues: ["Freinage fort", "Genou aligne", "Relance explosive"],
  },
  codDecelStick: {
    howTo: "Sprint court puis arret net en position stable.",
    cues: ["Bassin bas", "Genou aligne", "Controle"],
  },
  cod45: {
    howTo: "Sprint puis coupe a 45 deg en controle.",
    cues: ["Appui externe", "Bassin bas", "Regard haut"],
  },
  cod90: {
    howTo: "Sprint puis coupe a 90 deg en controle.",
    cues: ["Freinage", "Genou aligne", "Relance propre"],
  },
  codShuffleSprint: {
    howTo: "Shuffle lateral puis sprint frontal court.",
    cues: ["Appuis courts", "Transition rapide", "Controle"],
  },
  codLateralShuffleDecel: {
    howTo: "Shuffle lateral puis deceleration controlee.",
    cues: ["Bassin bas", "Controle", "Genou stable"],
  },
  plyoSkips: {
    howTo: "Skips en montant le genou et en restant reactif.",
    cues: ["Posture haute", "Contacts courts", "Rythme"],
  },
  plyoBoxLow: {
    howTo: "Step-up saute sur box basse, controle la reception.",
    cues: ["Reception douce", "Genou stable", "Controle"],
  },
  plyoDepth: {
    howTo: "Descends d une box, reception puis rebond rapide.",
    cues: ["Contacts courts", "Genou stable", "Hauteur controlee"],
  },
  plyoPogo: {
    howTo: "Petits rebonds rapides sur l avant du pied.",
    cues: ["Contacts courts", "Chevilles actives", "Posture haute"],
    videoUrl: "https://www.youtube.com/results?search_query=pogo+hops+plyometrics",
  },
  plyoLineLat: {
    howTo: "Sauts lateraux rapides au-dessus d une ligne.",
    cues: ["Appuis rapides", "Genou stable", "Controle"],
  },
  plyoLineFwd: {
    howTo: "Sauts avant/arriere rapides au-dessus d une ligne.",
    cues: ["Rythme", "Controle", "Appuis courts"],
  },
  plyoAnkleBounces: {
    howTo: "Rebonds cheville, amplitude faible.",
    cues: ["Contacts courts", "Posture haute", "Chevilles actives"],
  },
  plyoSnapdown: {
    howTo: "Tombe en position athletique puis stabilise.",
    cues: ["Bassin bas", "Genou aligne", "Controle"],
  },
  plyoJumpRope: {
    howTo: "Corde a sauter rythme facile.",
    cues: ["Contacts courts", "Epaules relachees", "Posture droite"],
  },
  plyoCmjStick: {
    howTo: "Saut vertical puis stabilise la reception.",
    cues: ["Reception douce", "Genou aligne", "Controle"],
    videoUrl: "https://www.youtube.com/results?search_query=countermovement+jump+technique",
  },
  plyoSquatJump: {
    howTo: "Squat puis saut, reception stable.",
    cues: ["Puissance", "Reception douce", "Controle"],
  },
  plyoVerticalJump: {
    howTo: "Saut vertical avec reach, reception controlee.",
    cues: ["Posture haute", "Reception douce", "Controle"],
  },
  plyoBroadJump: {
    howTo: "Saut en longueur, stabilise la reception.",
    cues: ["Projection forte", "Reception stable", "Genou aligne"],
  },
  plyoJumpForwardStep: {
    howTo: "Saut avant puis pas de stabilisation.",
    cues: ["Controle", "Bassin stable", "Reception douce"],
  },
  plyoSingleLegHop: {
    howTo: "Saut sur une jambe, reception stable.",
    cues: ["Genou aligne", "Bassin stable", "Controle"],
  },
  plyoLateralBound: {
    howTo: "Saut lateral puissant, stabilise la reception.",
    cues: ["Bassin stable", "Genou aligne", "Controle"],
  },
  plyoSkaterJump: {
    howTo: "Saut lateral type patineur, reception controlee.",
    cues: ["Bassin stable", "Controle", "Genou aligne"],
  },
  plyoSingleLegHopInPlace: {
    howTo: "Saut sur place sur une jambe, reception stable.",
    cues: ["Cheville active", "Genou aligne", "Controle"],
  },
  runEasy: {
    howTo: "Course facile en aisance respiratoire, rythme regulier.",
    cues: ["Posture haute", "Pas relaches", "Respiration nasale possible"],
  },
  runModerate: {
    howTo: "Course a rythme modere, effort controle.",
    cues: ["Cadence stable", "Relachement", "Respiration controlee"],
  },
  runTempo: {
    howTo: "Rythme tempo soutenu mais stable, sans sprinter.",
    cues: ["Cadence stable", "Respiration forte", "Relachement"],
  },
  runIntervals: {
    howTo: "Repetitions rapides avec recuperation complete.",
    cues: ["Qualite avant volume", "Posture haute", "Recup complete"],
  },
  runHills: {
    howTo: "Sprints courts en cote, recuperation complete.",
    cues: ["Poussee forte", "Buste legerement incline", "Appuis puissants"],
  },
  runStrides: {
    howTo: "Accelerations progressives courtes, retour au calme.",
    cues: ["Progressif", "Posture haute", "Relachement"],
  },
  runWalkRun: {
    howTo: "Alterne marche et course facile.",
    cues: ["Rythme facile", "Respiration controlee", "Progressif"],
  },
  bikeEasy: {
    howTo: "Pedalage facile en cadence confortable.",
    cues: ["Dos droit", "Cadence fluide", "Sans forcer"],
  },
  rowEasy: {
    howTo: "Rameur facile, poussee jambes puis tirage.",
    cues: ["Dos droit", "Sequence jambe- bras", "Rythme fluide"],
  },
  inclineWalk: {
    howTo: "Marche en pente a rythme modere.",
    cues: ["Posture droite", "Pas regulier", "Respiration controlee"],
  },
  fartlekEasy: {
    howTo: "Variations libres entre facile et modere.",
    cues: ["Reste relache", "Controle", "Progressif"],
  },
  accel: {
    howTo: "Sprint court en acceleration maximale.",
    cues: ["Poussee forte", "Buste incline", "Appuis rapides"],
    videoUrl: "https://www.youtube.com/results?search_query=sprint+acceleration+technique",
  },
  fallingStart: {
    howTo: "Penche-toi puis accelere des que tu pars.",
    cues: ["Inclinaison controllee", "Appuis rapides", "Posture"],
  },
  hillSprint: {
    howTo: "Sprint court en cote.",
    cues: ["Poussee forte", "Appuis courts", "Gainage"],
  },
  wallDrillHold: {
    howTo: "Position sprint contre un mur, tiens la posture.",
    cues: ["Bassin stable", "Alignement", "Tension"],
  },
  wallDrillSwitch: {
    howTo: "Position sprint contre un mur, alterne les appuis.",
    cues: ["Rythme rapide", "Bassin stable", "Posture"],
  },
  aMarch: {
    howTo: "Marche technique avec montee de genou.",
    cues: ["Genou haut", "Pied actif", "Posture"],
  },
  aSkip: {
    howTo: "Skip technique avec rebond.",
    cues: ["Posture haute", "Appuis courts", "Rythme"],
  },
  dribbles: {
    howTo: "Petits pas rapides sous le bassin.",
    cues: ["Appuis courts", "Chevilles actives", "Posture haute"],
  },
  fastLegCycles: {
    howTo: "Cycles de jambe rapides sur place.",
    cues: ["Posture haute", "Hanches stables", "Rythme rapide"],
  },
  flying10: {
    howTo: "Lancee progressive puis 10m a vitesse max.",
    cues: ["Relachement", "Posture haute", "Appuis rapides"],
  },
  medballChestPass: {
    howTo: "Passe rapide contre un mur, recupere et repete.",
    cues: ["Tronc gaine", "Projection rapide", "Controle"],
  },
  medballRotational: {
    howTo: "Rotation du tronc puis lancer lateral.",
    cues: ["Hanches actives", "Tronc gaine", "Controle"],
  },
  medballSlam: {
    howTo: "Monte le medball puis slam au sol.",
    cues: ["Tronc gaine", "Controle", "Respiration"],
  },
} as const;

export const EXERCISE_INSTRUCTIONS: Record<string, ExerciseInstruction> = {
  // Run
  run_easy_20: T.runEasy,
  run_mod_30: T.runModerate,
  run_tempo_2x8: T.runTempo,
  run_intervals_8x200: T.runIntervals,
  run_hills_10x10s: T.runHills,
  easy_jog_20_30: T.runEasy,
  tempo_20_30: T.runTempo,
  run_strides: T.runStrides,
  match_recovery_jog: T.runEasy,
  run_walk_run_intervals_20: T.runWalkRun,
  bike_easy_25_35: T.bikeEasy,
  row_easy_15_25: T.rowEasy,
  incline_walk_20_30: T.inclineWalk,
  run_fartlek_easy_20: T.fartlekEasy,
  run_strides_10_15s: T.runStrides,
  run_build_up_20_30m: T.runStrides,
  sprint_accel_5m: T.accel,
  sprint_accel_10m: T.accel,
  sprint_accel_15m: T.accel,
  sprint_accel_20m: T.accel,
  sprint_falling_start_10m: T.fallingStart,
  sprint_hill_8_10s: T.hillSprint,
  speed_wall_drill_hold: T.wallDrillHold,
  speed_wall_drill_switches: T.wallDrillSwitch,
  speed_a_march: T.aMarch,
  speed_a_skip: T.aSkip,
  speed_dribbles: T.dribbles,
  speed_fast_leg_cycles: T.fastLegCycles,
  sprint_flying_10m: T.flying10,

  // Plyo
  plyo_low_skips: T.plyoSkips,
  plyo_box_low: T.plyoBoxLow,
  plyo_depth_jumps: T.plyoDepth,
  plyo_pogo_hops: T.plyoPogo,
  plyo_line_hops_lateral: T.plyoLineLat,
  plyo_line_hops_fwd_back: T.plyoLineFwd,
  plyo_ankle_bounces: T.plyoAnkleBounces,
  plyo_snapdown_stick: T.plyoSnapdown,
  plyo_jump_rope_easy: T.plyoJumpRope,
  plyo_cmj_stick: T.plyoCmjStick,
  plyo_squat_jump_stick: T.plyoSquatJump,
  plyo_vertical_jump_reach: T.plyoVerticalJump,
  plyo_broad_jump_stick: T.plyoBroadJump,
  plyo_jump_forward_step_stick: T.plyoJumpForwardStep,
  plyo_single_leg_hop_stick: T.plyoSingleLegHop,
  plyo_lateral_bound_stick: T.plyoLateralBound,
  plyo_skater_jump_stick: T.plyoSkaterJump,
  plyo_single_leg_hop_in_place_stick: T.plyoSingleLegHopInPlace,

  // Strength squat / lower
  str_goblet_squat: T.gobletSquat,
  str_back_squat: T.squatBar,
  str_front_squat: T.frontSquat,
  str_box_squat: T.boxSquat,
  str_pause_squat: T.pauseSquat,
  str_wall_sit: T.wallSit,
  str_leg_press: T.legPress,
  str_hack_squat_machine: T.hackSquat,
  str_belt_squat: T.beltSquat,
  str_goblet_box_squat: T.gobletBoxSquat,
  str_air_squat_box: T.airSquatBox,
  str_spanish_squat_iso: T.spanishSquat,
  str_sit_to_stand: T.sitToStand,

  // Strength hinge
  str_trapbar_deadlift: T.trapBarDeadlift,
  str_rdl: T.rdl,
  str_rdl_bar: T.rdl,
  str_db_rdl: T.rdl,
  str_kb_deadlift: T.rdl,
  str_deadlift_heavy: T.deadliftHeavy,
  str_good_morning: T.goodMorning,
  str_bb_hip_thrust: T.hipThrust,
  str_db_hip_thrust: T.hipThrust,
  str_glute_bridge: T.gluteBridge,
  str_single_leg_bridge: T.singleLegBridge,
  str_single_leg_rdl: T.singleLegRdl,
  str_single_leg_rdl_reach: T.singleLegRdlReach,
  str_cable_pullthrough: T.cablePullThrough,
  str_back_extension_45: T.backExtension,
  str_hamstring_curl_machine: T.hamCurlMachine,
  str_swiss_ball_leg_curl: T.hamCurlSwiss,
  str_slider_leg_curl: T.hamCurlSlider,
  str_hip_thrust_iso_hold: T.hipThrustIso,

  // Strength unilateral
  str_db_split_squat: T.splitSquat,
  str_bulgarian_split: T.bulgarianSplit,
  str_reverse_lunge: T.reverseLunge,
  str_forward_lunge: T.forwardLunge,
  str_step_up: T.stepUp,
  str_step_down: T.stepDown,
  str_db_hip_airplane: T.hipAirplane,
  str_split_squat_iso_hold: T.splitSquat,
  str_single_leg_box_squat: T.singleLegBoxSquat,
  str_lateral_step_up: T.lateralStepUp,
  str_skater_squat_to_box: T.skaterSquat,
  str_lateral_step_down: T.lateralStepDown,
  str_lateral_lunge: T.lateralLunge,
  str_cossack: T.cossack,

  // Strength prevention
  str_nordic: T.nordic,
  str_razor_curl: T.razorCurl,
  str_ham_walkout: T.hamWalkout,
  str_copenhagen: T.copenhagen,
  str_nordic_assisted_band: T.nordicAssisted,
  str_eccentric_nordic_3s: T.nordicEccentric,
  str_adductor_slide: T.adductorSlide,
  str_adductor_squeeze_iso: T.adductorSqueeze,
  str_copenhagen_short_lever: T.copenhagenShort,

  // Strength upper push
  str_bench_press: T.benchPress,
  str_db_press: T.dumbbellPress,
  str_incline_db_press: T.inclineDbPress,
  str_pushup: T.pushup,
  str_pushup_feet_elevated: T.pushupFeetElevated,
  str_landmine_press: T.landminePress,
  str_oh_press: T.ohPress,
  str_incline_pushup: T.inclinePushup,
  str_floor_press_db: T.floorPress,
  str_machine_chest_press: T.machinePress,
  upper_fast_pushup: T.fastPushup,
  upper_hand_release_pushup: T.handReleasePushup,
  upper_incline_fast_pushup: T.inclineFastPushup,

  // Strength upper pull
  str_row: T.rowBar,
  str_one_arm_row: T.oneArmRow,
  str_inverted_row: T.invertedRow,
  str_pullup: T.pullup,
  str_band_row: T.bandRow,
  str_table_row: T.tableRow,
  str_lat_pulldown: T.latPulldown,
  str_chest_supported_row: T.chestSupportedRow,
  str_cable_row: T.cableRow,
  str_trx_row: T.trxRow,
  str_pullup_assisted_band: T.pullupAssisted,

  // Strength upper armor
  str_face_pull: T.facePull,
  str_band_pull_apart: T.bandPullApart,
  str_ytw_raise: T.ytwRaise,
  str_prone_ytw: T.proneYtw,
  str_scap_pushup: T.scapPushup,
  str_wall_slide: T.wallSlide,
  str_band_external_rotation: T.bandExternalRotation,
  str_serratus_punch_band: T.serratusPunch,
  str_prone_t_raise: T.proneTRaise,
  str_dead_hang: T.deadHang,
  str_scapular_pullup: T.scapularPullup,
  str_low_trap_raise: T.lowTrapRaise,
  str_band_w_external_rotation: T.bandW,
  str_prone_cobra_hold: T.proneCobra,
  str_wall_angels: T.wallAngels,

  // Strength ankle / frontal
  str_calf_raise: T.calfRaise,
  str_calf_raise_bent_knee: T.calfRaiseBent,
  str_single_leg_calf_raise: T.calfRaiseSingle,
  str_tib_raise: T.tibRaise,
  str_ankle_dorsiflexion_band: T.ankleDorsiflexion,
  str_toe_walks: T.toeWalks,
  str_heel_walks: T.heelWalks,
  str_band_inversion_eversion: T.inversionEversion,
  str_single_leg_balance_reach: T.balanceReach,
  str_side_shuffle_band: T.sideShuffleBand,
  str_seated_calf_raise: T.seatedCalfRaise,
  str_soleus_iso_hold_wall: T.soleusIsoWall,
  str_single_leg_soleus_iso: T.soleusIsoSingle,
  str_jump_rope_easy: T.jumpRopeEasy,
  str_pogo_hops_low: T.pogoHopsLow,
  str_short_foot: T.shortFoot,
  str_toe_yoga: T.toeYoga,
  str_lateral_band_walk: T.lateralBandWalk,
  str_monster_walk: T.monsterWalk,
  str_side_plank_hip_abduction: T.sidePlankHipAbduction,

  // Core
  core_plank: T.plank,
  core_side_plank: T.sidePlank,
  core_pallof: T.pallof,
  core_deadbug: T.deadbug,
  core_rkc_plank: T.rkcPlank,
  core_bird_dog: T.birdDog,
  core_suitcase_carry: T.suitcaseCarry,
  core_farmer_carry: T.farmerCarry,
  core_band_chop: T.bandChop,
  core_pallof_iso_march: T.pallofIsoMarch,
  core_hollow_hold: T.hollowHold,
  core_plank_shoulder_taps: T.plankShoulderTaps,
  core_stir_the_pot_swissball: T.stirThePot,
  core_half_kneeling_pallof: T.halfKneelingPallof,
  core_deadbug_band_resisted: T.deadbugBand,

  // Mobility
  mob_hips: T.mobilityHips,
  mob_ankle: T.mobilityAnkle,
  mob_tspine: T.mobilityTspine,
  mob_shoulder: T.mobilityShoulder,

  // Circuit
  circuit_low_bodyweight: T.circuitLow,
  circuit_mod_mix: T.circuitMod,
  circuit_hi: T.circuitHi,

  // COD
  cod_cone_drills_low: T.codCones,
  cod_t_drill: T.tDrill,
  cod_505: T.cod505,
  cod_decel_to_stick: T.codDecelStick,
  cod_45_cut_tech: T.cod45,
  cod_90_cut_tech: T.cod90,
  cod_shuffle_to_sprint_5_10m: T.codShuffleSprint,
  cod_lateral_shuffle_decel: T.codLateralShuffleDecel,

  // Medball / power
  mb_chest_pass_wall: T.medballChestPass,
  mb_rotational_throw_wall: T.medballRotational,
  mb_overhead_slam: T.medballSlam,

  // ── Explosivité — vitesse max longue + accélérations (ajouts) ──
  sprint_flying_20m: {
    howTo: "Prends 15m d'élan progressif, puis lâche tout sur 20m à pleine vitesse. Reste grand et relâché, récupère longtemps entre chaque course.",
    cues: ["Élan progressif", "Relâche le haut du corps", "Repos long entre les courses"],
  },
  sprint_flying_30m: {
    howTo: "Élan d'environ 15m puis 30m maintenus à vitesse maximale. Garde une foulée ample sans te crisper.",
    cues: ["Monte en vitesse en douceur", "Foulée ample", "Repos complet entre les reps"],
  },
  run_build_up_40m: {
    howTo: "Accélère progressivement sur 40m pour atteindre ta vitesse max en fin de course. Montée en régime lisse, sans à-coup.",
    cues: ["Accélération progressive", "Vmax en fin de course", "Pas de saccade"],
  },
  sprint_float_sprint_30m: {
    howTo: "10m vite, 10m relâché en gardant la vitesse, puis 10m vite à nouveau. La transition doit rester fluide.",
    cues: ["Garde la vitesse en relâchant", "Transition fluide", "Re-accélère franc"],
  },
  sprint_ins_and_outs_50m: {
    howTo: "Alterne environ 10m accélérés et 10m relâchés sur 50m, sans perdre trop de vitesse pendant les phases relâchées.",
    cues: ["Relâche sans freiner", "Reste rapide", "Foulée économique"],
  },
  speed_wicket_run_maxv: {
    howTo: "Cours sur des mini-haies basses et rapprochées en montant les genoux. Cherche un contact au sol bref et une cadence haute.",
    cues: ["Genoux hauts", "Contact au sol court", "Cadence rapide"],
  },
  sprint_3point_start_10m: {
    howTo: "Pars en position 3 appuis (une main au sol). Pousse fort sur le premier appui et projette-toi vers l'avant sur 10m.",
    cues: ["Premier appui puissant", "Corps projeté vers l'avant", "Reste bas au départ"],
  },
  sprint_pushup_start_10m: {
    howTo: "Depuis la position de pompe, relève-toi le plus vite possible et enchaîne un sprint de 10m sans temps mort.",
    cues: ["Relève-toi vite", "Enchaîne sans pause", "Accélère franc"],
  },
  speed_dribble_to_sprint_15m: {
    howTo: "Amorce avec quelques appuis sautillés pour lancer la fréquence, puis passe en sprint franc sur 15m.",
    cues: ["Appuis sautillés courts", "Transition nette", "Sprint plein"],
  },

  // ── Explosivité — préhab ischios/adducteurs (ajouts) ──
  str_nordic_hamstring_eccentric: {
    howTo: "Genoux calés et chevilles bloquées, descends le buste vers l'avant le plus lentement possible en résistant avec les ischios. Amortis avec les mains puis repousse-toi pour remonter.",
    cues: ["Descente la plus lente possible", "Bassin et tronc alignés", "Mains prêtes à amortir"],
  },
  str_copenhagen_adductor: {
    howTo: "Avant-bras au sol, pied de la jambe haute posé sur un banc. Monte le bassin jusqu'à l'alignement et tiens, en gardant le corps gainé.",
    cues: ["Corps aligné", "Bassin haut", "Gaine les adducteurs"],
  },
  str_hamstring_slider_curl: {
    howTo: "Allongé sur le dos, talons sur sliders ou serviette, bassin levé. Tends lentement les jambes puis ramène les talons en gainant les ischios.",
    cues: ["Bassin haut tout du long", "Extension lente", "Ramène en contrôle"],
  },
  str_single_leg_rdl_explo: {
    howTo: "En appui sur une jambe, descends en charnière de hanche lente et contrôlée, puis reviens debout par une extension rapide et puissante.",
    cues: ["Descente contrôlée", "Dos neutre", "Remontée explosive"],
  },
  str_adductor_iso_squeeze_band: {
    howTo: "Allongé ou assis, place un élastique ou une serviette pliée entre les genoux et presse fort les cuisses l'une vers l'autre. Tiens 20 à 40 secondes.",
    cues: ["Presse fort et constant", "Respiration libre", "Tiens 20-40s"],
  },

  // ── Explosivité — reset mobilité (ajouts) ──
  mob_hip_flexor_dynamic: {
    howTo: "En fente, bascule lentement le bassin vers l'avant puis reviens, buste droit. Tu dois sentir l'ouverture à l'avant de la hanche arrière.",
    cues: ["Buste droit", "Ne creuse pas le dos", "Mouvement lent et rythmé"],
  },
  mob_ankle_rocks: {
    howTo: "Genou qui avance au-dessus des orteils puis revient, talon collé au sol. Va-et-vient lents et contrôlés sur chaque cheville.",
    cues: ["Talon au sol", "Genou vers l'avant", "Amplitude progressive"],
  },
  mob_hip_airplane: {
    howTo: "En appui sur une jambe, buste penché et aligné, ouvre puis referme lentement le bassin en gardant l'équilibre.",
    cues: ["Garde l'équilibre", "Mouvement lent", "Pied stable au sol"],
  },
  mob_walking_spiderman: {
    howTo: "En avançant, pose une grande fente avec la main au sol côté pied avant et amène le coude vers la cheville. Enchaîne pas après pas.",
    cues: ["Grande fente", "Coude vers la cheville", "Avance en contrôle"],
  },
  // ── Backfill catalogue V2 (05/07/2026) — execution.steps/cues verbatim des fiches backend ──
  bike_intervals_40_20: {
    howTo: "40 s soutenu, cadence haute. 20 s facile sans t'arrêter de pédaler. Enchaîne les répétitions (10 en legacy) en gardant la posture stable.",
    cues: ["Cadence haute", "Posture stable", "Qualité avant volume"],
  },
  circuit_home_cardio: {
    howTo: "Enchaîne les 5 composants : 30 s chacun, 15 s de repos entre. Récupère entre les tours, repars propre. 3-4 tours (donnée legacy), technique avant tout.",
    cues: ["30/15 au chrono", "Amortis les réceptions", "Qualité avant volume"],
  },
  circuit_tabata_bodyweight: {
    howTo: "Lance le minuteur Tabata : 20 s d'effort, 10 s de repos, 8 rounds. Choisis un composant par round (ou alterne). Arrête un round plus tôt si la technique se dégrade.",
    cues: ["Effort franc 20 s", "Repos total 10 s", "Technique jusqu'au bout"],
  },
  core_bicycle_crunch: {
    howTo: "Amène le coude vers le genou opposé en pédalant. Épaules décollées, mouvement lent. Alterne sans tirer sur la nuque.",
    cues: ["Lent et contrôlé", "Ne tire pas la nuque", "Coude vers genou opposé"],
  },
  core_mcgill_curl_up: {
    howTo: "Décolle légèrement tête et épaules d'un bloc. Le creux lombaire reste soutenu par les mains. Tiens brièvement puis redescends. Change de jambe à mi-série.",
    cues: ["Décollement minime", "Tête et épaules d'un bloc", "Respiration calme"],
  },
  core_mountain_climbers: {
    howTo: "Amène un genou vers la poitrine puis alterne. Bassin stable, épaules au-dessus des mains. Rythme adapté à l'objectif (contrôle ou cardio).",
    cues: ["Bassin stable", "Épaules sur les mains", "Rythme maîtrisé"],
  },
  core_v_ups: {
    howTo: "Monte buste et jambes en même temps pour toucher tes pieds. Redescends en contrôle sans t'écraser au sol. Garde le mouvement fluide.",
    cues: ["Monte d'un bloc", "Redescends contrôlé", "Respiration calme"],
  },
  mob_inchworm: {
    howTo: "Penche-toi et marche avec les mains jusqu'en planche. Marche les pieds vers les mains, jambes quasi tendues. Redresse-toi et répète en avançant.",
    cues: ["Jambes quasi tendues au retour", "Planche complète", "Rythme lent"],
  },
  mob_scorpion_stretch: {
    howTo: "Monte un pied vers la main opposée en tournant le bassin. Épaules qui restent le plus possible au sol. Reviens lentement et alterne.",
    cues: ["Épaules au sol", "Rotation lente", "Amplitude confortable, jamais forcée"],
  },
  mob_spiderman_walk: {
    howTo: "Avance en grande fente, pose les mains au sol côté pied avant. Ouvre la hanche (coude qui plonge vers la cheville si confortable) puis tourne le buste vers le genou avant. Passe au pas suivant.",
    cues: ["Grande fente", "Ouvre la hanche", "Rotation contrôlée"],
  },
  nordic_curl_partner: {
    howTo: "Le partenaire cale les chevilles fermement. Descends le plus lentement possible, corps aligné. Amortis avec les mains puis remonte en poussant avec les bras.",
    cues: ["Le plus lent possible", "Corps aligné", "Mains prêtes"],
  },
  plyo_pogo_hops_low: {
    howTo: "Micro-rebonds très courts. Amplitude minimale, cheville active. Reste léger et régulier.",
    cues: ["Amplitude minimale", "Contact au sol court", "Reste léger"],
  },
  protocol_acceleration_pyramid_10_20_30: {
    howTo: "Accélération sur 10 m : départ gainé, poussées longues. Puis accélération sur 20 m : monte le buste progressivement. Puis accélération sur 30 m : termine à vitesse élevée, décélère en douceur. Récupération complète entre chaque course.",
    cues: ["Poussées longues au départ", "Monte le buste progressivement", "Récupération complète entre les courses"],
  },
  row_intervals_500m: {
    howTo: "500 m à allure rythmée et régulière. 90 s de récupération easy (pédalage doux ou pause). Enchaîne les répétitions (6 en legacy) sans dégrader le tirage.",
    cues: ["Jambes puis bras", "Dos neutre", "Allure régulière"],
  },
  run_intervals: {
    howTo: "Cours vite pendant le temps de travail (RPE 7-8, pas un sprint à bloc). Récupère en trottinant/marchant pendant le temps de récup. Respecte le repos entre séries (2-3 min easy, donnée legacy).",
    cues: ["Course relâchée", "Le chrono décide", "Qualité avant volume"],
  },
  run_intervals_1000m: {
    howTo: "1000 m proche du seuil, allure stable. Récupère 90-120 s en trottinant ou marchant. Répète (4-5 en legacy) sans sprint final.",
    cues: ["Allure stable", "Reste relâchée", "Jamais de sprint final"],
  },
  run_intervals_300m: {
    howTo: "300 m rythmés, allure régulière. Récupère 60-75 s easy. Répète (8 en legacy) proprement.",
    cues: ["Répète propre", "Reste relâchée", "Jamais de sprint final"],
  },
  run_intervals_400m: {
    howTo: "400 m en allure soutenue et stable. Récupère 75-90 s easy ou en marchant. Répète (6 en legacy) en gardant la même allure.",
    cues: ["Allure stable", "Reste relâchée", "Jamais de sprint final"],
  },
  run_tempo_cruise_5min: {
    howTo: "5 minutes en tempo contrôlé. 90 s easy. Répète (4 blocs en legacy) sans dérive d'allure.",
    cues: ["Garde le contrôle", "Allure constante", "Reste relâchée"],
  },
  run_tempo_cruise_8min: {
    howTo: "8 minutes en tempo Z3, cadence stable. 2 minutes easy sans t'arrêter. Répète (3 blocs en legacy).",
    cues: ["Cadence stable", "Technique propre", "Reste relâchée"],
  },
  run_threshold_10min: {
    howTo: "10 minutes proche du seuil, allure stable. 3 minutes easy. Répète (2 blocs en legacy). Jamais à bloc.",
    cues: ["Stable, pas à bloc", "Reste relâchée", "Respiration contrôlée"],
  },
  sled_push_heavy: {
    howTo: "Mains sur les poignées, corps incliné bas. Poussées longues et complètes, regard devant. Récupération longue entre les passages.",
    cues: ["Angle bas", "Pousse complet", "Tronc gainé"],
  },
  speed_wall_drill_a_skip: {
    howTo: "Appui mains contre mur, montées de genou alternées explosives, angle tibia/hanche propre, contact court.",
    cues: [],
  },
  speed_wicket_run: {
    howTo: "Prends ton élan progressif. Cours par-dessus les wickets en gardant une posture haute. Contacts courts et rythmés, genoux hauts.",
    cues: ["Posture haute", "Contacts courts", "Genoux hauts"],
  },
  sprint_acceleration: {
    howTo: "Départ gainé, poussées longues sur les premiers appuis. Monte le buste progressivement. Décélère en douceur après la distance cible.",
    cues: ["Poussées longues", "Gainage fort", "Récupération complète entre les courses"],
  },
  sprint_flying: {
    howTo: "Monte en régime progressivement sur l'élan. Traverse la zone lancée à pleine vitesse, posture haute et relâchée. Décélère progressivement, récupération complète. Stoppe la série si la vitesse baisse.",
    cues: ["Posture haute", "Épaules et visage relâchés", "Récupération complète entre les courses"],
  },
  sprint_max_velocity_exposure: {
    howTo: "Sprint complet sur la distance choisie : accélère puis atteins ta vitesse élevée. Épaules et visage relâchés à haute vitesse. Récupération complète entre les courses.",
    cues: ["Épaules et visage relâchés", "Posture haute", "Récupération complète entre les courses"],
  },
  str_archer_pushup: {
    howTo: "Descends vers une main, l'autre jambe... l'autre bras reste tendu. Pousse pour revenir au centre. Alterne les côtés.",
    cues: ["Bras opposé tendu", "Corps aligné comme une planche", "Descente contrôlée"],
  },
  str_clamshell: {
    howTo: "Ouvre le genou du dessus sans bouger le bassin. Pause brève en ouverture. Referme lentement.",
    cues: ["Bassin immobile", "Pieds joints", "Tempo lent et contrôlé"],
  },
  str_fire_hydrant: {
    howTo: "Ouvre un genou sur le côté, hanche qui travaille. Dos stable, sans rotation du buste. Reviens en contrôle.",
    cues: ["Dos stable", "Ouvre par la hanche", "Tempo lent et contrôlé"],
  },
  str_pike_pushup: {
    howTo: "Hanches hautes, plie les coudes pour descendre la tête vers le sol. Pousse pour revenir en pike. Regard entre les mains.",
    cues: ["Hanches hautes", "Tête vers les mains", "Descente contrôlée"],
  },
  str_pistol_squat_assisted: {
    howTo: "Descends sur une jambe en t'aidant des mains. Jambe libre tendue devant. Remonte en poussant, assistance minimale.",
    cues: ["Assistance minimale", "Genoux alignés sur les pieds", "Talon au sol"],
  },
  str_superman_hold: {
    howTo: "Décolle légèrement bras et jambes du sol. Regard vers le sol, nuque longue. Tiens la position en respirant.",
    cues: ["Nuque longue", "Décollage léger", "Respire"],
  },
  treadmill_intervals_60_60: {
    howTo: "60 s soutenu (pas un sprint). 60 s easy en réduisant la vitesse. Répète (12 en legacy) en restant fluide.",
    cues: ["Soutenu, pas sprint", "Reste fluide", "Qualité avant volume"],
  },
};

export const getExerciseInstruction = (id: string) =>
  EXERCISE_INSTRUCTIONS[id] ?? null;
