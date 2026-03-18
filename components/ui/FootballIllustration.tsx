// components/ui/FootballIllustration.tsx
// Silhouettes SVG de footballeur — style minimaliste, single color.
// Utilisé comme décoration d'ambiance (position absolute, opacity faible).

import React, { Component, type ReactNode } from "react";
import { AccessibilityInfo, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { theme } from "../../constants/theme";

/* ─── Types ─── */
export type IllustrationType =
  | "celebration"
  | "sprint"
  | "strength"
  | "rest"
  | "empty";

type Props = {
  type: IllustrationType;
  width?: number;
  height?: number;
  color?: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
};

/* ─── Error boundary léger ─── */
class IllustrationBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? null : this.props.children; }
}

/* ─── SVG Paths (viewBox 0 0 100 100) ─── */
// Style : silhouettes minimalistes, 2-4 courbes max. Footballeur reconnaissable par la pose.

const paths: Record<IllustrationType, (color: string) => ReactNode> = {
  // Joueur bras levés, genoux fléchis — célébration Mbappe-style
  celebration: (c) => (
    <>
      <Circle cx="50" cy="16" r="7" fill={c} />
      <Path
        d="M50 23 C50 23 44 32 44 40 L38 28 L34 30 L42 44 L42 55 L36 75 L32 90 L38 91 L46 72 L50 60 L54 72 L62 91 L68 90 L64 75 L58 55 L58 44 L66 30 L62 28 L56 40 C56 32 50 23 50 23Z"
        fill={c}
      />
    </>
  ),

  // Joueur en pleine course, penché en avant
  sprint: (c) => (
    <>
      <Circle cx="62" cy="18" r="7" fill={c} />
      <Path
        d="M60 25 C58 30 52 36 48 42 L38 38 L36 42 L48 48 L44 58 L30 72 L26 88 L32 90 L44 74 L52 62 L56 74 L58 90 L64 89 L60 72 L56 54 L62 42 C66 34 64 28 60 25Z"
        fill={c}
      />
      <Path
        d="M62 36 L74 32 L76 36 L64 40Z"
        fill={c}
      />
    </>
  ),

  // Joueur en squat athlétique, pieds écartés
  strength: (c) => (
    <>
      <Circle cx="50" cy="16" r="7" fill={c} />
      <Path
        d="M50 23 C48 28 46 34 46 40 L46 52 L34 68 L28 82 L34 84 L42 70 L48 58 L50 58 L52 58 L58 70 L66 84 L72 82 L66 68 L54 52 L54 40 C54 34 52 28 50 23Z"
        fill={c}
      />
      <Path
        d="M46 36 L34 32 L32 36 L44 40Z"
        fill={c}
      />
      <Path
        d="M54 36 L66 32 L68 36 L56 40Z"
        fill={c}
      />
    </>
  ),

  // Joueur assis, une jambe étendue — récupération/étirement
  rest: (c) => (
    <>
      <Circle cx="38" cy="22" r="7" fill={c} />
      <Path
        d="M38 29 C36 34 34 40 34 46 L34 58 L28 72 L26 84 L32 85 L36 73 L38 62 L48 62 L62 66 L74 68 L75 63 L62 60 L46 56 L42 46 C42 38 40 32 38 29Z"
        fill={c}
      />
      <Path
        d="M34 38 L24 34 L22 38 L32 42Z"
        fill={c}
      />
    </>
  ),

  // Joueur debout avec ballon au pied
  empty: (c) => (
    <>
      <Circle cx="50" cy="14" r="7" fill={c} />
      <Path
        d="M50 21 C48 26 46 32 46 38 L46 52 L40 68 L36 84 L42 86 L48 70 L50 58 L52 70 L58 86 L64 84 L60 68 L54 52 L54 38 C54 32 52 26 50 21Z"
        fill={c}
      />
      <Path
        d="M46 34 L36 30 L34 34 L44 38Z"
        fill={c}
      />
      <Path
        d="M54 34 L64 30 L66 34 L56 38Z"
        fill={c}
      />
      <Circle cx="38" cy="86" r="5" fill="none" stroke={c} strokeWidth="1.5" />
    </>
  ),
};

/* ─── Composant ─── */
function FootballIllustrationInner({
  type,
  width = 100,
  height = 100,
  color,
  opacity = 0.12,
  style,
}: Props) {
  // Fallback gracieux : dimensions invalides → rien
  if (width <= 0 || height <= 0) return null;

  const fill = color ?? theme.colors.accent;
  const renderPaths = paths[type];
  if (!renderPaths) return null;

  return (
    <View
      style={[{ width, height, opacity }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Svg width={width} height={height} viewBox="0 0 100 100">
        {renderPaths(fill)}
      </Svg>
    </View>
  );
}

export const FootballIllustration = React.memo(function FootballIllustration(props: Props) {
  return (
    <IllustrationBoundary>
      <FootballIllustrationInner {...props} />
    </IllustrationBoundary>
  );
});
