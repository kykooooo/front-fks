import React, { Component, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import { theme } from "../../constants/theme";

export type TrainingIllustrationVariant = "session" | "summary";

type Props = {
  variant: TrainingIllustrationVariant;
  width?: number;
  height?: number;
  primaryColor?: string;
  accentColor?: string;
  secondaryColor?: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
};

class IllustrationBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

function SessionIllustration({
  primaryColor,
  accentColor,
  secondaryColor,
}: Required<Pick<Props, "primaryColor" | "accentColor" | "secondaryColor">>) {
  return (
    <>
      <Defs>
        <SvgLinearGradient id="sessionPanel" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={secondaryColor} stopOpacity="0.82" />
          <Stop offset="100%" stopColor={primaryColor} stopOpacity="0.1" />
        </SvgLinearGradient>
        <SvgLinearGradient id="sessionTrail" x1="0%" y1="50%" x2="100%" y2="50%">
          <Stop offset="0%" stopColor={accentColor} stopOpacity="0" />
          <Stop offset="44%" stopColor={accentColor} stopOpacity="0.95" />
          <Stop offset="100%" stopColor={accentColor} stopOpacity="0.22" />
        </SvgLinearGradient>
      </Defs>

      <Ellipse cx="146" cy="182" rx="70" ry="20" fill={secondaryColor} opacity="0.18" />

      <Path
        d="M88 36 L164 24 L196 72 L180 140 L106 156 L60 112 Z"
        fill="url(#sessionPanel)"
        opacity="0.6"
      />
      <Path
        d="M78 54 C104 40 132 34 166 34"
        stroke={secondaryColor}
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.38"
      />
      <Path
        d="M66 82 C100 68 142 60 188 64"
        stroke={secondaryColor}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.24"
      />

      <G>
        <Circle cx="150" cy="52" r="13" fill={primaryColor} />
        <Path
          d="M148 67 C143 80 128 96 114 108 L96 100 L89 107 L106 120 L100 136 L76 160 L66 188 L78 192 L98 166 L116 146 L126 160 L134 192 L146 190 L142 156 L150 126 C162 116 172 102 179 82 L170 74 C163 86 156 96 148 104 L136 98 L145 82 C150 74 152 70 148 67 Z"
          fill={primaryColor}
        />
        <Path
          d="M126 98 L148 104"
          stroke={accentColor}
          strokeWidth="4.5"
          strokeLinecap="round"
          opacity="0.92"
        />
        <Path
          d="M100 136 L118 146"
          stroke={accentColor}
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.7"
        />
      </G>

      <Path
        d="M112 108 C90 114 66 124 38 140"
        stroke="url(#sessionTrail)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <Path
        d="M118 126 C92 134 64 146 30 166"
        stroke={accentColor}
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.58"
      />
      <Path
        d="M132 144 C106 150 80 162 52 180"
        stroke={accentColor}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.35"
      />

      <Path
        d="M42 164 C44 154 53 146 64 146 C75 146 84 154 86 164 C84 175 75 182 64 182 C53 182 44 175 42 164 Z"
        fill="none"
        stroke={accentColor}
        strokeWidth="4.5"
      />
      <Path
        d="M64 147 L64 181 M47 164 L81 164 M54 154 L74 174 M74 154 L54 174"
        stroke={accentColor}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.88"
      />

      <Rect
        x="184"
        y="92"
        width="12"
        height="44"
        rx="6"
        fill={secondaryColor}
        opacity="0.28"
      />
      <Rect
        x="196"
        y="84"
        width="10"
        height="56"
        rx="5"
        fill={accentColor}
        opacity="0.74"
      />
      <Path
        d="M176 82 L206 68"
        stroke={accentColor}
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.54"
      />
    </>
  );
}

function SummaryIllustration({
  primaryColor,
  accentColor,
  secondaryColor,
}: Required<Pick<Props, "primaryColor" | "accentColor" | "secondaryColor">>) {
  return (
    <>
      <Defs>
        <SvgLinearGradient id="summaryHalo" x1="50%" y1="0%" x2="50%" y2="100%">
          <Stop offset="0%" stopColor={accentColor} stopOpacity="0.3" />
          <Stop offset="100%" stopColor={secondaryColor} stopOpacity="0.02" />
        </SvgLinearGradient>
        <SvgLinearGradient id="summaryRibbon" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={accentColor} stopOpacity="0.98" />
          <Stop offset="100%" stopColor={secondaryColor} stopOpacity="0.66" />
        </SvgLinearGradient>
      </Defs>

      <Ellipse cx="112" cy="188" rx="64" ry="20" fill={secondaryColor} opacity="0.18" />
      <Circle cx="112" cy="72" r="64" fill="url(#summaryHalo)" opacity="0.9" />

      <Path
        d="M56 56 C74 28 92 18 112 18 C132 18 150 28 168 56"
        stroke={accentColor}
        strokeWidth="7"
        strokeLinecap="round"
        opacity="0.86"
      />
      <Path
        d="M48 78 L64 58 L82 76"
        stroke={secondaryColor}
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.9"
      />
      <Path
        d="M176 76 L190 58 L206 74"
        stroke={secondaryColor}
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.9"
      />

      <G>
        <Circle cx="112" cy="58" r="13" fill={primaryColor} />
        <Path
          d="M112 72 C102 84 94 100 94 114 L72 88 L63 96 L84 126 L84 144 L68 178 L80 184 L98 150 L112 136 L126 150 L144 184 L156 178 L140 144 L140 126 L161 96 L152 88 L130 114 C130 100 122 84 112 72 Z"
          fill={primaryColor}
        />
        <Path
          d="M84 126 L112 136 L140 126"
          stroke={accentColor}
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.78"
        />
      </G>

      <Path
        d="M84 132 C94 146 104 154 112 158 C120 154 130 146 140 132"
        fill="none"
        stroke={secondaryColor}
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.92"
      />

      <Path
        d="M156 36 L162 24 L170 36 L184 40 L172 48 L174 62 L162 54 L150 62 L152 48 L140 40 Z"
        fill="url(#summaryRibbon)"
      />
      <Path
        d="M40 118 L48 102 L56 118 L72 126 L56 132 L48 148 L40 132 L24 126 Z"
        fill={accentColor}
        opacity="0.76"
      />
      <Path
        d="M184 112 L190 100 L196 112 L208 118 L196 124 L190 136 L184 124 L172 118 Z"
        fill={accentColor}
        opacity="0.58"
      />

      <Rect
        x="36"
        y="76"
        width="10"
        height="36"
        rx="5"
        fill={secondaryColor}
        opacity="0.4"
        transform="rotate(-18 36 76)"
      />
      <Rect
        x="186"
        y="142"
        width="10"
        height="32"
        rx="5"
        fill={secondaryColor}
        opacity="0.32"
        transform="rotate(18 186 142)"
      />
    </>
  );
}

function TrainingIllustrationInner({
  variant,
  width = 140,
  height = 140,
  primaryColor,
  accentColor,
  secondaryColor,
  opacity = 1,
  style,
}: Props) {
  if (width <= 0 || height <= 0) return null;

  const primary = primaryColor ?? theme.colors.white18;
  const accent = accentColor ?? theme.colors.accentAlt;
  const secondary = secondaryColor ?? theme.colors.white35;

  return (
    <View
      style={[{ width, height, opacity }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Svg width={width} height={height} viewBox="0 0 220 220">
        {variant === "summary" ? (
          <SummaryIllustration
            primaryColor={primary}
            accentColor={accent}
            secondaryColor={secondary}
          />
        ) : (
          <SessionIllustration
            primaryColor={primary}
            accentColor={accent}
            secondaryColor={secondary}
          />
        )}
      </Svg>
    </View>
  );
}

export const TrainingIllustration = React.memo(function TrainingIllustration(
  props: Props
) {
  return (
    <IllustrationBoundary>
      <TrainingIllustrationInner {...props} />
    </IllustrationBoundary>
  );
});
