// config/textScaling.ts
//
// Cap GLOBAL du facteur d'agrandissement de police (accessibilite iOS/Android,
// "Dynamic Type"). Sans borne, un utilisateur qui pousse la taille systeme au
// max fait deborder tous les layouts. On autorise un agrandissement raisonnable
// (jusqu'a 1.3x) puis on plafonne.
//
// Mecanisme : defaultProps sur les primitives Text/TextInput -> aucun wrapper a
// propager sur les centaines de <Text> de l'app (pas de chasse ecran par ecran).
// Importe une seule fois, en premier, dans App.tsx.
import { Text, TextInput } from "react-native";

export const MAX_FONT_SCALE = 1.3;

type Scalable = { defaultProps?: { maxFontSizeMultiplier?: number } };

const TextDefaults = Text as unknown as Scalable;
TextDefaults.defaultProps = TextDefaults.defaultProps ?? {};
TextDefaults.defaultProps.maxFontSizeMultiplier = MAX_FONT_SCALE;

const TextInputDefaults = TextInput as unknown as Scalable;
TextInputDefaults.defaultProps = TextInputDefaults.defaultProps ?? {};
TextInputDefaults.defaultProps.maxFontSizeMultiplier = MAX_FONT_SCALE;
