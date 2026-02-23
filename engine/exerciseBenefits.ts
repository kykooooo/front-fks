// engine/exerciseBenefits.ts
// Banque de "pourquoi" par exercice - bénéfices spécifiques au football

/**
 * Bénéfices spécifiques par ID d'exercice.
 * Format court, orienté football, explique le "pourquoi" de l'exo.
 */
const SPECIFIC_BENEFITS: Record<string, string> = {
  // ===== RUNNING / ENDURANCE =====
  vma_short: "Développe ta VMA pour tenir les efforts répétés en match.",
  run_engine_intervals_30_30_2x10: "Améliore ta capacité à enchaîner les efforts courts, comme les pressing répétés.",
  run_engine_intervals_15_15_2x12: "Travaille ta récupération active entre les sprints.",
  run_engine_intervals_6x400: "Construit ton endurance de base pour tenir 90 minutes.",
  run_engine_intervals_8x300: "Développe ta puissance aérobie pour les fins de match.",
  run_engine_tempo_cruise_3x8: "Améliore ton seuil lactique pour gérer les temps forts.",
  run_engine_tempo_cruise_4x5: "Apprend à courir efficace à haute intensité prolongée.",
  run_fartlek_easy_20: "Travaille les changements de rythme comme en situation de jeu.",
  easy_jog_20_30: "Favorise la récupération active et le drainage musculaire.",
  match_recovery_jog: "Accélère la récupération post-match sans fatiguer.",
  run_engine_z2_30_40: "Construit ta base aérobie pour supporter les charges d'entraînement.",
  run_engine_z2_40_55: "Développe ton endurance fondamentale pour la saison.",
  run_strides_10_15s: "Active ta foulée et prépare le système neuromusculaire.",
  run_strides: "Travaille la qualité de foulée et la coordination à vitesse modérée.",
  tempo_20_30: "Améliore ton économie de course pour moins te fatiguer.",
  run_build_up_20_30m: "Prépare progressivement ton corps aux sprints.",
  run_build_up_30_40m: "Développe l'accélération progressive sur distance.",

  // ===== SPRINT / VITESSE =====
  sprint_accel_5m: "Améliore ton démarrage explosif sur les premiers pas.",
  sprint_accel_10m: "Développe l'accélération courte pour les duels.",
  sprint_accel_15m: "Travaille la phase d'accélération complète.",
  sprint_accel_20m: "Optimise ta vitesse sur les courses de transition.",
  sprint_flying_10m: "Développe ta vitesse de pointe maximale.",
  sprint_flying_20m: "Travaille le maintien de la vitesse max sur distance.",
  spd_flying20: "Améliore ta capacité à sprinter lancé.",
  sprint_hill_8_10s: "Renforce la puissance des jambes en côte.",
  sprint_falling_start_10m: "Travaille la réactivité au départ.",
  spd_accel_10_20_30: "Développe l'accélération sur différentes distances.",
  spd_start_fall_forward: "Améliore la posture et l'inclinaison au départ.",

  // ===== TECHNIQUE DE COURSE =====
  speed_a_march: "Corrige ta mécanique de course pour plus d'efficacité.",
  spd_a_run: "Automatise le mouvement de genou haut à vitesse.",
  speed_a_skip: "Développe la coordination et l'élasticité de foulée.",
  speed_b_skip: "Travaille l'extension complète de hanche au sprint.",
  speed_high_knees: "Renforce les fléchisseurs de hanche pour la fréquence.",
  speed_butt_kicks: "Améliore le retour talon-fesse pour une foulée rapide.",
  speed_ankling: "Développe la rigidité de cheville pour des appuis réactifs.",
  speed_dribbles: "Travaille la fréquence de pas ultra-rapide.",
  speed_straight_leg_run: "Renforce la chaîne postérieure en course.",
  speed_fast_leg_cycles: "Améliore la vitesse de cycle de jambe.",
  speed_wall_drill_hold: "Apprend la position optimale d'accélération.",
  speed_wall_drill_knee_drive: "Renforce le drive de genou pour l'accélération.",
  speed_wall_drill_switches: "Développe la coordination jambe au sprint.",
  cod_wall_drill_a_skip: "Combine technique de course et puissance murale.",

  // ===== COD / AGILITÉ =====
  cod_5_10_5: "Améliore tes changements de direction rapides comme en dribble.",
  cod_t_test: "Travaille l'agilité multidirectionnelle du footballeur.",
  cod_l_drill: "Développe les changements de direction à 90°.",
  cod_shuttle_10_20: "Améliore la navette défensive et les replis.",
  cod_zigzag_cones: "Travaille les changements de direction enchaînés.",
  cod_45_cut_tech: "Perfectionne les coupes à 45° pour les crochets.",
  cod_90_cut_tech: "Maîtrise les changements de direction brutaux.",
  cod_curve_run: "Améliore ta course en courbe pour les appels.",
  cod_curve_exit_5_5: "Travaille la sortie de courbe explosive.",
  cod_decel_to_stick: "Apprend à freiner net pour feinter.",
  cod_decel_lateral_stick: "Maîtrise la décélération latérale.",
  cod_lateral_shuffle_decel: "Combine déplacement latéral et arrêt.",
  cod_shuffle_to_sprint_5_10m: "Enchaîne défense latérale et sprint.",
  cod_backpedal_to_turn: "Travaille la transition recul-sprint des défenseurs.",
  cod_crossover_step_tech: "Perfectionne le pas croisé pour les démarrages.",
  cod_pivot_180_tech: "Maîtrise le pivot pour les retournements.",
  cod_stop_go_3m: "Développe les arrêts-départs explosifs.",
  cod_wicket_drill_short: "Travaille la fréquence d'appuis en agilité.",

  // ===== RSA (REPEATED SPRINT ABILITY) =====
  rsa_runs_20_20_2x8: "Développe ta capacité à répéter les sprints en match.",
  rsa_sprint_10m_repeat: "Simule les efforts répétés du pressing haut.",
  rsa_sprint_15m_repeat: "Travaille la répétition de sprints moyens.",
  rsa_sprint_20m_repeat: "Améliore la récupération entre sprints longs.",
  rsa_sprint_walkback_20m: "Simule sprint + retour marche comme en match.",
  rsa_shuttle_10_20_repeat: "Développe l'endurance de navette défensive.",
  rsa_shuttle_15_15_repeat: "Travaille les allers-retours répétés.",
  rsa_reaction_sprint_10m: "Ajoute la composante réactive au RSA.",
  rsa_ssg_3v3: "Simule les efforts intermittents en petit jeu.",
  rsa_ssg_4v4: "Travaille l'intensité des situations réduites.",
  rsa_ssg_5v5: "Combine tactique et condition physique.",

  // ===== PLYOMÉTRIE =====
  plyo_cmj_stick: "Développe la puissance de saut pour les duels aériens.",
  plyo_countermovement_jump: "Améliore ton détente verticale.",
  plyo_cm_jump: "Travaille l'explosivité du saut.",
  plyo_squat_jump: "Renforce la puissance concentrique des jambes.",
  plyo_squat_jump_stick: "Apprend à atterrir stable après un saut.",
  plyo_box_jump: "Développe la puissance explosive des jambes.",
  plyo_box_jump_low: "Version accessible pour apprendre le mouvement.",
  plyo_broad_jump_stick: "Améliore la puissance horizontale pour les départs.",
  plyo_bounds: "Développe la puissance de foulée bondissante.",
  plyo_lateral_bound_stick: "Renforce la poussée latérale pour les crochets.",
  plyo_skater_jump_stick: "Travaille la puissance latérale unipode.",
  plyo_split_jump: "Améliore l'explosivité en position de fente.",
  plyo_split_jump_power: "Version puissance du split jump.",
  plyo_snap_down_to_jump: "Apprend à utiliser l'énergie élastique.",
  plyo_snapdown_stick: "Travaille l'absorption et la rigidité.",
  plyo_drop_to_broad_stick: "Combine absorption et explosion horizontale.",
  plyo_pogo_hops: "Développe la raideur de cheville pour les appuis.",
  plyo_pogos: "Renforce l'élasticité tendon d'Achille.",
  str_pogo_hops_low: "Version basse intensité pour la cheville.",
  plyo_ankle_bounces: "Améliore la réactivité des chevilles.",
  plyo_line_hops_fwd_back: "Travaille la coordination et la rapidité d'appuis.",
  plyo_line_hops_lateral: "Développe les appuis latéraux rapides.",
  plyo_single_leg_hop_stick: "Renforce la stabilité unipode à l'atterrissage.",
  plyo_single_leg_hop_in_place_stick: "Travaille l'équilibre dynamique sur un pied.",
  plyo_jump_forward_step_stick: "Combine saut et réception stable.",
  plyo_vertical_jump_reach: "Teste et développe ta détente maximale.",

  // ===== FORCE BAS DU CORPS =====
  str_back_squat: "Développe la force globale des jambes pour les duels.",
  str_front_squat: "Renforce les quadriceps et le gainage simultanément.",
  str_goblet_squat: "Apprend le pattern squat avec charge accessible.",
  str_goblet_box_squat: "Travaille la profondeur contrôlée.",
  str_box_squat: "Développe la puissance de sortie depuis l'arrêt.",
  str_pause_squat: "Élimine l'élan pour plus de force pure.",
  str_air_squat: "Renforce les jambes sans charge.",
  str_air_squat_pause_2s: "Travaille le contrôle en position basse.",
  str_air_squat_tempo_3s: "Développe le temps sous tension.",
  str_air_squat_box: "Apprend la profondeur correcte.",
  str_belt_squat: "Charge les jambes sans stresser le dos.",
  str_hack_squat_machine: "Isole les quadriceps en sécurité.",
  str_leg_press: "Développe la force de poussée des jambes.",
  str_wall_sit: "Renforce l'endurance isométrique des quadriceps.",
  str_spanish_squat_iso: "Travaille les quadriceps sans stress rotulien.",
  str_sit_to_stand: "Renforce le mouvement fonctionnel de base.",

  // ===== FORCE UNILATERAL =====
  str_bulgarian_split: "Corrige les déséquilibres gauche/droite.",
  str_rfess_db_power: "Développe la puissance unipode explosive.",
  str_db_split_squat: "Renforce chaque jambe indépendamment.",
  str_split_squat_iso_hold: "Travaille la stabilité en position de fente.",
  str_split_squat_jump_low: "Ajoute l'explosivité au travail unipode.",
  str_reverse_lunge: "Renforce les fessiers et protège les genoux.",
  str_forward_lunge: "Travaille la force de fente avant.",
  str_lateral_lunge: "Développe la force latérale pour les changements de direction.",
  str_step_up: "Renforce la poussée unipode fonctionnelle.",
  str_step_up_power: "Version explosive du step up.",
  str_lateral_step_up: "Travaille la force latérale sur step.",
  str_step_down: "Contrôle excentrique pour protéger les genoux.",
  str_lateral_step_down: "Renforce le contrôle latéral descendant.",
  str_single_leg_box_squat: "Développe la force unipode maximale.",
  str_skater_squat_to_box: "Travaille l'équilibre et la force sur une jambe.",
  str_cossack: "Améliore la mobilité et force latérale.",

  // ===== CHAÎNE POSTÉRIEURE =====
  str_rdl_bar: "Renforce les ischio-jambiers pour prévenir les blessures.",
  str_db_rdl: "Version haltères du RDL.",
  str_backpack_rdl: "Version accessible avec sac à dos.",
  str_single_leg_rdl: "Travaille la chaîne postérieure unipode.",
  str_single_leg_rdl_reach: "Ajoute l'équilibre au RDL unipode.",
  str_trapbar_deadlift: "Développe la force de tirage en sécurité.",
  str_trapbar_deadlift_light: "Version légère pour le volume.",
  str_kb_deadlift: "Apprend le hip hinge avec kettlebell.",
  str_good_morning: "Renforce les érecteurs et ischio-jambiers.",
  str_hip_thrust: "Développe la puissance des fessiers pour le sprint.",
  str_bb_hip_thrust: "Version barre pour charges lourdes.",
  str_db_hip_thrust: "Version haltères accessible.",
  str_hip_thrust_iso_hold: "Travaille l'endurance des fessiers.",
  str_glute_bridge: "Active et renforce les fessiers.",
  str_single_leg_bridge: "Corrige les asymétries de fessiers.",
  str_slider_leg_curl: "Renforce les ischio-jambiers en excentrique.",
  str_swiss_ball_leg_curl: "Travaille les ischios avec instabilité.",
  str_hamstring_curl_machine: "Isole les ischio-jambiers.",
  str_nordic: "Prévient les blessures aux ischio-jambiers.",
  str_nordic_assisted_band: "Version assistée pour progresser.",
  str_eccentric_nordic_3s: "Travaille la phase excentrique protectrice.",
  str_razor_curl: "Alternative au nordic pour les ischios.",
  str_back_extension_45: "Renforce toute la chaîne postérieure.",
  str_cable_pullthrough: "Active les fessiers sans charge vertébrale.",

  // ===== ADDUCTEURS / PRÉVENTION =====
  str_copenhagen: "Prévient les blessures aux adducteurs.",
  str_copenhagen_short_lever: "Version accessible du Copenhagen.",
  str_adductor_squeeze_iso: "Active les adducteurs en isométrique.",
  str_adductor_slide: "Renforce les adducteurs en dynamique.",

  // ===== MOLLETS / CHEVILLES =====
  str_calf_raise: "Renforce les mollets pour les sprints et sauts.",
  str_calf_raise_bent_knee: "Cible le soléaire pour la stabilité.",
  str_calf_raise_iso_hold: "Travaille l'endurance des mollets.",
  str_single_leg_calf_raise: "Corrige les asymétries de mollets.",
  str_seated_calf_raise: "Isole le soléaire assis.",
  str_single_leg_soleus_iso: "Travaille le soléaire unipode.",
  str_soleus_iso_hold_wall: "Renforce le soléaire en isométrique.",
  str_tib_raise: "Renforce le tibial pour prévenir les périostites.",
  str_tib_raise_iso_hold: "Version isométrique du tibial.",
  str_ankle_dorsiflexion_band: "Améliore la mobilité de cheville.",
  str_band_inversion_eversion: "Stabilise la cheville latéralement.",
  str_toe_walks: "Renforce les fléchisseurs des orteils.",
  str_heel_walks: "Renforce le tibial antérieur.",
  str_short_foot: "Active la voûte plantaire pour la stabilité.",
  str_toe_yoga: "Améliore le contrôle des orteils.",

  // ===== HAUT DU CORPS POUSSÉE =====
  str_bench_press: "Développe la force de poussée pour les duels.",
  str_db_press: "Travaille la poussée avec stabilisation.",
  str_incline_db_press: "Cible le haut des pectoraux.",
  str_floor_press_db: "Poussée sécurisée au sol.",
  str_floor_press_bottles: "Version accessible avec bouteilles.",
  str_oh_press: "Renforce les épaules pour les contacts.",
  str_landmine_press: "Poussée diagonale fonctionnelle.",
  str_db_push_press_light: "Ajoute l'explosivité à la poussée.",
  str_kb_push_press: "Version kettlebell explosive.",
  str_machine_chest_press: "Développe la force de poussée guidée.",
  str_pushup: "Renforce le haut du corps sans matériel.",
  str_pushup_wide: "Cible davantage les pectoraux.",
  str_pushup_close_grip: "Cible les triceps.",
  str_pushup_pause_2s: "Élimine l'élan pour plus de force.",
  str_pushup_tempo_3s: "Augmente le temps sous tension.",
  str_pushup_feet_elevated: "Version plus difficile des pompes.",
  str_incline_pushup: "Version accessible des pompes.",
  upper_fast_pushup: "Développe la vitesse de poussée.",
  upper_incline_fast_pushup: "Pompes rapides accessibles.",
  upper_explosive_pushup_to_hands_release: "Pompes explosives pliométriques.",
  upper_hand_release_pushup: "Force de départ depuis le sol.",
  upper_plyo_pushup: "Développe la puissance du haut du corps.",
  upper_wall_plyo_pushup: "Version murale pliométrique.",
  upper_side_to_side_plyo_pushup: "Pompes plyo latérales.",
  upper_staggered_plyo_pushup: "Pompes plyo décalées.",
  upper_drop_pushup: "Absorbe et repousse explosif.",
  str_scap_pushup: "Renforce les stabilisateurs d'épaule.",
  str_bench_dip: "Renforce les triceps fonctionnellement.",

  // ===== HAUT DU CORPS TIRAGE =====
  str_pullup: "Développe la force de tirage verticale.",
  str_pullup_assisted_band: "Version assistée pour progresser.",
  str_scapular_pullup: "Renforce les stabilisateurs scapulaires.",
  str_lat_pulldown: "Tirage vertical guidé.",
  str_row: "Renforce le dos pour l'équilibre musculaire.",
  str_cable_row: "Tirage horizontal câble.",
  str_one_arm_row: "Corrige les déséquilibres du dos.",
  str_chest_supported_row: "Tirage sans stress lombaire.",
  str_backpack_row: "Version accessible avec sac à dos.",
  str_band_row: "Tirage avec bande élastique.",
  str_trx_row: "Tirage au poids du corps.",
  str_table_row: "Tirage accessible sous une table.",
  str_inverted_row: "Tirage horizontal au poids du corps.",

  // ===== ÉPAULES / PRÉVENTION =====
  str_face_pull: "Équilibre les épaules et prévient les blessures.",
  str_band_pull_apart: "Renforce la coiffe des rotateurs.",
  str_band_w_external_rotation: "Prévention des blessures d'épaule.",
  str_band_external_rotation: "Renforce les rotateurs externes.",
  str_ytw_raise: "Travaille les stabilisateurs scapulaires.",
  str_prone_y_raise_bw: "Renforce le bas du trapèze.",
  str_prone_t_raise: "Travaille les rhomboïdes.",
  str_prone_t_raise_bw: "Version poids du corps.",
  str_prone_w_raise_bw: "Renforce la coiffe des rotateurs.",
  str_prone_ytw: "Combine les trois mouvements.",
  str_prone_cobra_hold: "Renforce l'extension thoracique.",
  str_low_trap_raise: "Cible le bas du trapèze.",
  str_wall_angels: "Améliore la mobilité des épaules.",
  str_wall_slide: "Travaille le contrôle scapulaire.",
  str_serratus_punch_band: "Renforce le serratus pour la stabilité.",
  str_dead_hang: "Décompresse les épaules et renforce la prise.",

  // ===== PUISSANCE / EXPLOSIVITÉ =====
  str_trapbar_jump: "Développe la puissance explosive chargée.",
  str_jump_squat_light: "Travaille l'explosivité du squat.",
  str_kb_swing: "Développe la puissance de hanche.",
  str_kb_swing_one_arm: "Version unilaterale du swing.",
  str_kb_high_pull: "Combine tirage et extension de hanche.",
  str_bb_jump_shrug: "Travaille le triple extension.",
  str_db_jump_shrug: "Version haltères du jump shrug.",
  mb_chest_pass_wall: "Développe la puissance de poussée.",
  mb_overhead_slam: "Travaille la puissance de frappe.",
  mb_scoop_toss_forward: "Puissance de projection horizontale.",
  mb_rotational_throw_wall: "Développe la puissance rotationnelle.",

  // ===== ÉQUILIBRE / PROPRIOCEPTION =====
  str_single_leg_balance_reach: "Améliore l'équilibre dynamique.",
  str_single_leg_balance_toe_taps: "Travaille la stabilité avec perturbation.",
  str_single_leg_balance_eyes_closed: "Challenge la proprioception.",
  str_db_hip_airplane: "Combine équilibre et mobilité de hanche.",

  // ===== CORE =====
  core_plank: "Renforce le gainage de base pour la stabilité.",
  core_rkc_plank: "Version haute intensité du gainage.",
  core_side_plank: "Renforce les obliques et stabilisateurs.",
  core_side_plank_hip_abduction: "Ajoute le travail de hanche.",
  core_side_plank_reach_through: "Gainage latéral avec rotation.",
  core_side_plank_row: "Combine gainage et tirage.",
  core_copenhagen_side_plank: "Gainage avec travail d'adducteurs.",
  core_plank_shoulder_taps: "Gainage avec déstabilisation.",
  core_plank_knee_taps: "Travaille le contrôle pelvien.",
  core_front_plank_reach: "Gainage anti-rotation.",
  core_deadbug: "Apprend la dissociation tronc/membres.",
  core_deadbug_band_resisted: "Version avec résistance.",
  core_deadbug_loaded: "Deadbug avec charge.",
  core_deadbug_iso_hold: "Travaille le maintien de position.",
  core_bird_dog: "Renforce le contrôle lombaire.",
  core_hollow_hold: "Développe le gainage antérieur.",
  core_hollow_rocks: "Version dynamique du hollow.",
  core_pallof: "Travaille l'anti-rotation pour les contacts.",
  core_pallof_iso_march: "Pallof avec défi d'équilibre.",
  core_half_kneeling_pallof: "Pallof en position de fente.",
  core_band_chop: "Renforce les obliques en rotation.",
  core_band_lift: "Travaille la rotation vers le haut.",
  core_stir_pot: "Gainage dynamique avancé.",
  core_stir_the_pot_swissball: "Version swiss ball.",
  core_ab_wheel_rollout: "Développe la force anti-extension.",
  core_leg_lowering_90_90: "Contrôle pelvien et gainage.",
  core_mcGill_curl_up: "Renforce les abdominaux sans stress lombaire.",
  core_reverse_crunch: "Cible le bas des abdominaux.",
  core_hanging_knee_raise: "Renforce les fléchisseurs et abdos.",
  core_bear_crawl: "Travaille le gainage en mouvement.",
  core_farmer_carry: "Renforce le gainage sous charge.",
  core_suitcase_carry: "Travaille l'anti-flexion latérale.",
  core_offset_front_rack_carry: "Gainage asymétrique en marche.",

  // ===== MOBILITÉ =====
  mob_90_90_flow: "Améliore la rotation de hanche pour les changements de direction.",
  mob_adductor_rockback: "Ouvre les hanches pour les fentes latérales.",
  mob_couch_stretch: "Libère les fléchisseurs de hanche pour la foulée.",
  mob_ankle: "Améliore la dorsiflexion pour le squat et les appuis.",
  mob_ankle_df_band: "Mobilité de cheville assistée.",
  mob_hips: "Travaille la mobilité globale des hanches.",
  mob_thoracic: "Améliore la rotation thoracique pour les contacts.",
  mob_hamstring: "Libère les ischio-jambiers pour la foulée.",
  generic_spine_mobility: "Améliore la mobilité vertébrale globale.",
  generic_breathing_nasal: "Optimise la récupération et le retour au calme.",
  generic_walk_easy: "Récupération active douce.",
  incline_walk_20_30: "Cardio basse intensité sans impact.",

  // ===== CIRCUITS / RSA AVANCÉ =====
  circuit_mix: "Travaille l'endurance musculaire et cardiovasculaire.",
  circuit_bodyweight_football: "Circuit spécifique football sans matériel.",
  circuit_emom_bodyweight: "Format EMOM pour l'intensité contrôlée.",
  prowler_push: "Développe la puissance de poussée et le cardio.",
  rsa_circuit_shuttle_burpee: "Combine navette et exercice complet.",
  rsa_circuit_kb_swings_shuttle: "Mélange puissance et course.",
  rsa_row_sprints_20_40: "Sprints sur rameur.",
  rsa_sled_push_15m_repeat: "Poussée de traîneau répétée.",
  rsa_bike_sprints_15_45: "Sprints sur vélo sans impact.",
  speed_sled_push_light_fast_10_20m: "Accélération résistée légère.",
  speed_sled_push_heavy_10_20m: "Force de poussée lourde.",
  speed_sled_backward_drag_15_30m: "Renforce les quadriceps en tirage arrière.",

  // ===== CARDIO ALTERNATIF =====
  bike_easy_25_35: "Cardio sans impact pour récupérer.",
  bike_engine_tempo_20_30: "Travail tempo sur vélo.",
  bike_intervals: "Intervalles vélo pour le cardio.",
  row_easy_15_25: "Rameur basse intensité.",
  row_engine_tempo_12_20: "Travail tempo sur rameur.",
  rower_intervals: "Intervalles rameur.",
  treadmill_engine_intervals_12x60_60: "Intervalles sur tapis.",
  treadmill_engine_tempo_20_30: "Tempo sur tapis.",
  treadmill_accel_8_12s: "Sprints courts sur tapis.",
  treadmill_maxv_10_15s: "Vitesse max sur tapis.",
  run_walk_run_intervals_20: "Alternance course/marche pour débutants.",
  str_jump_rope_easy: "Cardio et coordination des appuis.",
};

/**
 * Fallbacks par catégorie pour les exercices non couverts spécifiquement.
 */
const CATEGORY_FALLBACKS: Record<string, string> = {
  // Patterns de début d'ID
  vma: "Développe ta capacité aérobie pour les efforts répétés en match.",
  run_engine: "Améliore ton endurance et ta récupération entre les efforts.",
  run: "Travaille ta base cardiovasculaire pour tenir 90 minutes.",
  easy_jog: "Favorise la récupération active post-effort.",
  tempo: "Améliore ton seuil lactique pour gérer les temps forts.",
  sprint: "Développe ta vitesse de pointe pour les situations décisives.",
  spd: "Travaille ta technique et ta vitesse de course.",
  speed: "Améliore ta mécanique de course pour plus d'efficacité.",
  cod: "Développe ton agilité pour les changements de direction.",
  rsa: "Améliore ta capacité à répéter les sprints en match.",
  plyo: "Développe ta puissance explosive pour les duels et les sauts.",
  str: "Renforce tes muscles pour la prévention et la performance.",
  upper: "Renforce le haut du corps pour l'équilibre musculaire.",
  mb: "Développe la puissance avec le medecine ball.",
  core: "Renforce ton gainage pour la stabilité et les contacts.",
  mob: "Améliore ta mobilité pour une meilleure amplitude de mouvement.",
  generic: "Contribue à ta récupération et ton bien-être général.",
  bike: "Travaille ton cardio sans impact sur les articulations.",
  row: "Développe ton endurance avec un travail complet du corps.",
  treadmill: "Travaille ta course en environnement contrôlé.",
  circuit: "Combine cardio et renforcement pour l'endurance musculaire.",
};

/**
 * Récupère le bénéfice d'un exercice par son ID.
 * Retourne le bénéfice spécifique si disponible, sinon un fallback par catégorie.
 */
export function getExerciseBenefit(exerciseId: string | null | undefined): string | null {
  if (!exerciseId) return null;

  const id = exerciseId.toLowerCase().trim();

  // D'abord chercher un bénéfice spécifique
  if (SPECIFIC_BENEFITS[id]) {
    return SPECIFIC_BENEFITS[id];
  }

  // Ensuite chercher par pattern de début
  for (const [pattern, benefit] of Object.entries(CATEGORY_FALLBACKS)) {
    if (id.startsWith(pattern)) {
      return benefit;
    }
  }

  // Fallback ultime basé sur le type d'exercice
  if (id.includes('squat') || id.includes('lunge') || id.includes('press') || id.includes('row')) {
    return "Renforce tes muscles pour améliorer ta performance sur le terrain.";
  }
  if (id.includes('jump') || id.includes('hop') || id.includes('bound')) {
    return "Développe ta puissance explosive pour les actions décisives.";
  }
  if (id.includes('sprint') || id.includes('accel')) {
    return "Améliore ta vitesse pour prendre l'avantage sur tes adversaires.";
  }

  return null;
}

/**
 * Vérifie si un exercice a un bénéfice disponible.
 */
export function hasExerciseBenefit(exerciseId: string | null | undefined): boolean {
  return getExerciseBenefit(exerciseId) !== null;
}
