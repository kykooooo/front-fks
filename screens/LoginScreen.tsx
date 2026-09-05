// screens/LoginScreen.tsx
// Connexion — même DA que le reste de l'app

import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Animated,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../services/firebase";
import { trackEvent } from "../services/analytics";
import { showToast } from "../utils/toast";
import { useHaptics } from "../hooks/useHaptics";
import { runShake } from "../utils/animations";
import { theme } from "../constants/theme";
import { Screen } from "../components/ui/Screen";
import { Button } from "../components/ui/Button";
import { BrandMark } from "../components/ui/BrandMark";
import { CoachEntryLink } from "../components/auth/CoachEntryLink";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;
const palette = theme.colors;

const getLoginErrorMessage = (code?: string) => {
  switch (code) {
    case "auth/invalid-email":
      return "Email invalide.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email ou mot de passe incorrect.";
    case "auth/too-many-requests":
      return "Trop de tentatives. Réessaie dans quelques minutes.";
    case "auth/network-request-failed":
      return "Problème réseau. Vérifie ta connexion.";
    default:
      return "Vérifie tes informations puis réessaie.";
  }
};

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;
  const pwdInputRef = useRef<TextInput>(null);
  const haptics = useHaptics();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailTrimmed = email.trim();
  const emailLooksValid = emailRegex.test(emailTrimmed);
  const canSubmit = emailLooksValid && pwd.length > 0;

  const onLogin = async () => {
    if (!email || !pwd) {
      showToast({ type: "warn", title: "Champs manquants", message: "Email et mot de passe requis." });
      runShake(shake);
      haptics.warning();
      return;
    }
    if (!emailLooksValid) {
      showToast({ type: "warn", title: "Email invalide", message: "Vérifie le format de ton email." });
      runShake(shake);
      haptics.warning();
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, emailTrimmed, pwd);
      trackEvent("login_success");
      haptics.success();
    } catch (e: any) {
      trackEvent("login_failed", { code: e?.code ?? "unknown" });
      runShake(shake);
      haptics.error();
      showToast({
        type: "error",
        title: "Connexion échouée",
        message: getLoginErrorMessage(e?.code),
      });
    } finally {
      setLoading(false);
    }
  };

  const onForgot = async () => {
    if (loading || sendingReset) return;
    if (!email) {
      showToast({ type: "warn", title: "Email requis", message: "Entre ton email pour recevoir le lien." });
      return;
    }
    if (!emailLooksValid) {
      showToast({ type: "warn", title: "Email invalide", message: "Vérifie le format avant de continuer." });
      return;
    }
    setSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, emailTrimmed);
      showToast({
        type: "success",
        title: "Email envoyé",
        message: "Vérifie ta boîte mail pour réinitialiser ton mot de passe.",
      });
    } catch (e: any) {
      if (__DEV__) console.warn("[reset password]", e?.code ?? e);
      showToast({
        type: "error",
        title: "Erreur",
        message: "Impossible d'envoyer l'email de réinitialisation.",
      });
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <Screen keyboardAvoiding style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* Gabarit d'en-tête identique à Register (DA Polish) : même zone de
              hauteur fixe pour la flèche retour. */}
          <View style={styles.headerRow}>
            {navigation.canGoBack() ? (
              <Pressable
                onPress={() => navigation.goBack()}
                style={({ pressed }) => [styles.back, pressed && styles.iconPressed]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chevron-back" size={20} color={palette.sub} />
              </Pressable>
            ) : null}
          </View>

          <BrandMark size="sm" style={styles.brandMark} />

          {/* Header */}
          <Text style={styles.title}>Content de te revoir</Text>
          <Text style={styles.subtitle}>Connecte-toi pour reprendre ta progression.</Text>

          {/* Form */}
          <Animated.View style={[styles.form, { transform: [{ translateX: shake }] }]}>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={16} color={palette.muted} style={styles.inputIcon} />
              <TextInput
                placeholder="Email"
                placeholderTextColor={palette.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                returnKeyType="next"
                onSubmitEditing={() => pwdInputRef.current?.focus()}
                style={styles.input}
              />
            </View>
            {email.length > 0 && !emailLooksValid ? (
              <Text style={styles.error}>Format email invalide</Text>
            ) : null}

            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={16} color={palette.muted} style={styles.inputIcon} />
              <TextInput
                ref={pwdInputRef}
                placeholder="Mot de passe"
                placeholderTextColor={palette.muted}
                secureTextEntry={!showPwd}
                autoComplete="password"
                value={pwd}
                onChangeText={setPwd}
                returnKeyType="go"
                onSubmitEditing={() => {
                  if (!loading && canSubmit) void onLogin();
                }}
                style={styles.input}
              />
              <Pressable
                onPress={() => setShowPwd(!showPwd)}
                style={({ pressed }) => [styles.eye, pressed && styles.iconPressed]}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons
                  name={showPwd ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={palette.muted}
                />
              </Pressable>
            </View>

            <Button
              label={loading ? "" : "Se connecter"}
              onPress={onLogin}
              disabled={loading || !canSubmit}
              variant="primary"
              size="lg"
              fullWidth
              style={[styles.ctaShadowOff, styles.ctaSpacing]}
              leftAccessory={loading ? <ActivityIndicator size="small" color="#fff" /> : undefined}
              accessibilityLabel="Se connecter"
            />

            {/* "Mot de passe oublié" descend sous le CTA en caption (DA Polish
                §1.5) : ce n'était pas un second CTA, il n'a plus besoin de
                rivaliser visuellement avec le bouton principal. */}
            <Pressable
              onPress={onForgot}
              disabled={loading || sendingReset}
              style={({ pressed }) => [
                styles.forgot,
                pressed && styles.linkPressed,
                (loading || sendingReset) && styles.forgotDisabled,
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.forgotText}>
                {sendingReset ? "Envoi en cours…" : "Mot de passe oublié ?"}
              </Text>
            </Pressable>
          </Animated.View>

          {/* Entrée coach — l'accueil qui la portait devient inatteignable dès
              le deuxième lancement (audit inscription 2026-09, erratum 1). Elle
              pose une INTENTION persistée, jamais un droit : l'espace coach
              reste dérivé de l'appartenance au club. */}
          <CoachEntryLink testID="coach-entry-login" />

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Pas de compte ?</Text>
            <Pressable
              onPress={() => navigation.navigate("Register")}
              style={({ pressed }) => pressed && styles.linkPressed}
              hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
            >
              <Text style={styles.footerLink}>Inscris-toi</Text>
            </Pressable>
          </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: palette.bg },
  scroll: { flexGrow: 1, paddingHorizontal: theme.spacing.xl2, justifyContent: "center", gap: 8 },
  // Zone de hauteur fixe (DA Polish) : identique à Register, même quand
  // canGoBack() est faux.
  headerRow: { height: 40, justifyContent: "center" },
  back: { alignSelf: "flex-start", padding: 8 },
  // DA Polish : opacité de press unifiée à 0.7 (lot0 §1.3, supprime 0.5/0.6).
  iconPressed: { opacity: 0.7 },
  linkPressed: { opacity: 0.7 },
  brandMark: { marginBottom: theme.spacing.lg },
  title: { ...theme.typography.title, color: palette.text, textAlign: "center" },
  subtitle: { ...theme.typography.body, color: palette.sub, textAlign: "center", marginBottom: theme.spacing.xl },
  form: { gap: theme.spacing.md },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, color: palette.text, fontSize: 15 },
  eye: { padding: 4 },
  error: { ...theme.typography.caption, color: palette.danger, marginLeft: 4 },
  forgot: { alignSelf: "center", paddingVertical: 12, marginTop: 4 },
  forgotDisabled: { opacity: 0.4 },
  forgotText: { ...theme.typography.caption, color: palette.sub },
  // Neutralise le halo orange de Button.primary (theme.shadow.accent porte
  // l'orange du dark, `#ff7a1a` — DA Polish lot0 §1.4). Local à cet écran :
  // Button.tsx garde son ombre par défaut pour ses 17 autres appelants.
  ctaShadowOff: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  ctaSpacing: { marginTop: 8 },
  footer: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: theme.spacing.xxl, paddingVertical: theme.spacing.lg },
  footerText: { ...theme.typography.body, color: palette.sub },
  footerLink: { color: palette.accent, fontSize: 15, fontWeight: "700" },
});
