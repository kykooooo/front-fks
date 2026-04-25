// screens/LoginScreen.tsx
// Connexion premium, alignee avec l'ambiance auth de FKS

import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";

import { AuthStackParamList } from "../navigation/RootNavigator";
import { auth } from "../services/firebase";
import { showError } from "../utils/errorHandler";
import { trackEvent } from "../services/analytics";
import { showToast } from "../utils/toast";
import { useHaptics } from "../hooks/useHaptics";
import { runShake } from "../utils/animations";
import { theme, TYPE, RADIUS } from "../constants/theme";
import { AuthBackground } from "../components/auth/AuthBackground";
import { PitchDecoration } from "../components/ui/PitchDecoration";
import { Button } from "../components/ui/Button";
import { signInWithApple, signInWithGoogle, isAppleSignInAvailable } from "../services/socialAuth";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

const palette = theme.colors;
const authColors = {
  text: theme.colors.zinc50,
  sub: theme.colors.zinc400,
  muted: theme.colors.white45,
  border: theme.colors.white10,
  borderSoft: theme.colors.white12,
  panel: theme.colors.panel92,
  input: `${theme.colors.surface}40`,
  inputFocused: `${theme.colors.surface}60`,
};

const getLoginErrorMessage = (code?: string) => {
  switch (code) {
    case "auth/invalid-email":
      return "Email invalide.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email ou mot de passe incorrect.";
    case "auth/too-many-requests":
      return "Trop de tentatives. Reessaie dans quelques minutes.";
    case "auth/network-request-failed":
      return "Probleme reseau. Verifie ta connexion.";
    default:
      return "Verifie tes informations puis reessaie.";
  }
};

export default function LoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(null);
  const shake = useRef(new Animated.Value(0)).current;
  const pwdInputRef = useRef<TextInput>(null);
  const haptics = useHaptics();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailTrimmed = email.trim();
  const emailLooksValid = emailRegex.test(emailTrimmed);
  const canSubmit = emailLooksValid && pwd.length > 0;

  const title = "Content de te revoir";
  const subtitle = "Reconnecte-toi pour reprendre ta progression, ta charge et tes seances.";
  const ctaLabel = loading ? "Connexion..." : "Se connecter";

  const formHint = useMemo(
    () =>
      emailLooksValid || email.length === 0
        ? "Ton espace joueur, ton historique et tes prochaines seances t'attendent."
        : "Entre un email valide pour reprendre exactement la ou tu t'es arrete.",
    [email.length, emailLooksValid]
  );

  const onLogin = async () => {
    if (!email || !pwd) {
      showToast({ type: "warn", title: "Champs manquants", message: "Email et mot de passe requis." });
      runShake(shake);
      haptics.warning();
      return;
    }
    if (!emailLooksValid) {
      showToast({ type: "warn", title: "Email invalide", message: "Verifie le format de ton email." });
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
        title: "Connexion echouee",
        message: getLoginErrorMessage(e?.code),
      });
      showError(e, "Connexion");
    } finally {
      setLoading(false);
    }
  };

  const onForgot = async () => {
    if (loading) return;
    if (!email) {
      showToast({ type: "warn", title: "Email requis", message: "Entre ton email pour recevoir le lien." });
      return;
    }
    if (!emailLooksValid) {
      showToast({ type: "warn", title: "Email invalide", message: "Verifie le format avant de continuer." });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, emailTrimmed);
      showToast({
        type: "success",
        title: "Email envoye",
        message: "Verifie ta boite mail pour reinitialiser ton mot de passe.",
      });
    } catch (e: any) {
      showError(e, "Reinitialisation mot de passe");
      showToast({
        type: "error",
        title: "Erreur",
        message: "Impossible d'envoyer l'email de reinitialisation.",
      });
    }
  };

  return (
    <AuthBackground>
      <SafeAreaView style={styles.safe} edges={["top", "right", "left", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView
              contentContainerStyle={[
                styles.scroll,
                { paddingBottom: Math.max(32, insets.bottom + 24) },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.topRow}>
                {navigation.canGoBack() ? (
                  <Pressable onPress={() => navigation.goBack()} style={styles.back}>
                    <Ionicons name="chevron-back" size={22} color={authColors.sub} />
                  </Pressable>
                ) : (
                  <View style={styles.backPlaceholder} />
                )}
              </View>

              <View style={styles.heroBlock}>
                <PitchDecoration
                  type="centerCircle"
                  width={200}
                  height={200}
                  color={theme.colors.white}
                  opacity={0.05}
                  style={styles.heroPitchMark}
                />
                <Text style={styles.logo}>FKS</Text>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
              </View>

              <Animated.View style={[styles.formShell, { transform: [{ translateX: shake }] }]}>
                <PitchDecoration
                  type="halfwayLine"
                  width={190}
                  height={70}
                  color={theme.colors.white}
                  opacity={0.04}
                  style={styles.formPitchMark}
                />

                <View style={styles.formCard}>
                  <View style={styles.formIntro}>
                    <Text style={styles.formKicker}>Retour joueur</Text>
                    <Text style={styles.formHint}>{formHint}</Text>
                  </View>

                  <View style={styles.formFields}>
                    <View
                      style={[
                        styles.inputWrap,
                        focusedField === "email" && styles.inputWrapFocused,
                      ]}
                    >
                      <Ionicons
                        name="mail-outline"
                        size={18}
                        color={focusedField === "email" ? palette.accent : authColors.muted}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        placeholder="Email"
                        placeholderTextColor={authColors.muted}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoComplete="email"
                        value={email}
                        onChangeText={setEmail}
                        returnKeyType="next"
                        onFocus={() => setFocusedField("email")}
                        onBlur={() => setFocusedField((prev) => (prev === "email" ? null : prev))}
                        onSubmitEditing={() => pwdInputRef.current?.focus()}
                        style={styles.input}
                      />
                    </View>

                    {email.length > 0 && !emailLooksValid ? (
                      <Text style={styles.error}>Format email invalide</Text>
                    ) : null}

                    <View
                      style={[
                        styles.inputWrap,
                        focusedField === "password" && styles.inputWrapFocused,
                      ]}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={18}
                        color={focusedField === "password" ? palette.accent : authColors.muted}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        ref={pwdInputRef}
                        placeholder="Mot de passe"
                        placeholderTextColor={authColors.muted}
                        secureTextEntry={!showPwd}
                        autoComplete="password"
                        value={pwd}
                        onChangeText={setPwd}
                        returnKeyType="go"
                        onFocus={() => setFocusedField("password")}
                        onBlur={() => setFocusedField((prev) => (prev === "password" ? null : prev))}
                        onSubmitEditing={() => {
                          if (!loading && canSubmit) void onLogin();
                        }}
                        style={styles.input}
                      />
                      <Pressable onPress={() => setShowPwd(!showPwd)} style={styles.eye}>
                        <Ionicons
                          name={showPwd ? "eye-off-outline" : "eye-outline"}
                          size={20}
                          color={focusedField === "password" ? palette.accent : authColors.muted}
                        />
                      </Pressable>
                    </View>

                    <Pressable
                      onPress={onForgot}
                      disabled={loading}
                      style={[styles.forgot, loading && styles.dimmed]}
                    >
                      <Text style={styles.forgotText}>Mot de passe oublie ?</Text>
                    </Pressable>
                  </View>

                  <View style={styles.ctaBlock}>
                    <Button
                      label={ctaLabel}
                      onPress={() => void onLogin()}
                      disabled={loading || !canSubmit}
                      fullWidth
                      size="lg"
                      variant="primary"
                    />
                    <View style={styles.dividerRow}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>ou</Text>
                      <View style={styles.dividerLine} />
                    </View>

                    {isAppleSignInAvailable() && (
                      <Pressable style={styles.socialButton} onPress={async () => {
                        try { setLoading(true); await signInWithApple(); haptics.success(); } catch (e: any) {
                          if (e?.code !== "ERR_REQUEST_CANCELED") { haptics.warning(); console.error("[Apple Sign-In]", e?.code, e?.message); showToast({ type: "error", title: "Apple", message: e?.message ?? "Erreur de connexion." }); }
                        } finally { setLoading(false); }
                      }} disabled={loading}>
                        <Ionicons name="logo-apple" size={20} color="#fff" />
                        <Text style={styles.socialButtonText}>Continuer avec Apple</Text>
                      </Pressable>
                    )}

                    <Pressable style={[styles.socialButton, styles.googleButton]} onPress={async () => {
                      try { setLoading(true); await signInWithGoogle(); haptics.success(); } catch {
                        haptics.warning(); showToast({ type: "error", title: "Google", message: "Erreur de connexion." });
                      } finally { setLoading(false); }
                    }} disabled={loading}>
                      <Ionicons name="logo-google" size={18} color="#fff" />
                      <Text style={styles.socialButtonText}>Continuer avec Google</Text>
                    </Pressable>

                    <View style={styles.footer}>
                      <Text style={styles.footerText}>Pas de compte ?</Text>
                      <Pressable onPress={() => navigation.navigate("Register")}>
                        <Text style={styles.footerLink}>Cree ton compte</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </Animated.View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
    justifyContent: "center",
  },
  topRow: {
    minHeight: 44,
    justifyContent: "center",
    marginBottom: 18,
  },
  back: {
    alignSelf: "flex-start",
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.white04,
    borderWidth: 1,
    borderColor: authColors.border,
  },
  backPlaceholder: {
    width: 44,
    height: 44,
  },
  heroBlock: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 28,
    gap: 10,
    position: "relative",
  },
  heroPitchMark: {
    position: "absolute",
    top: -44,
    alignSelf: "center",
  },
  logo: {
    fontSize: TYPE.hero.fontSize,
    fontWeight: "900",
    letterSpacing: 4,
    color: authColors.text,
    textAlign: "center",
  },
  title: {
    fontSize: TYPE.title.fontSize,
    fontWeight: "800",
    color: authColors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: TYPE.body.fontSize,
    color: authColors.sub,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
  },
  formShell: {
    position: "relative",
  },
  formPitchMark: {
    position: "absolute",
    top: 12,
    right: -22,
  },
  formCard: {
    padding: 22,
    borderRadius: RADIUS.xl,
    backgroundColor: authColors.panel,
    borderWidth: 1,
    borderColor: authColors.borderSoft,
    gap: 22,
    overflow: "hidden",
    ...theme.shadow.soft,
  },
  formIntro: {
    gap: 8,
  },
  formKicker: {
    fontSize: TYPE.micro.fontSize,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: palette.accent,
  },
  formHint: {
    fontSize: TYPE.caption.fontSize,
    color: authColors.sub,
    lineHeight: 18,
  },
  formFields: {
    gap: 12,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: authColors.input,
    borderWidth: 1,
    borderColor: authColors.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
  },
  inputWrapFocused: {
    borderColor: palette.accent,
    backgroundColor: authColors.inputFocused,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: authColors.text,
    fontSize: TYPE.body.fontSize,
  },
  eye: { padding: 4 },
  error: {
    color: palette.danger,
    fontSize: TYPE.caption.fontSize,
    fontWeight: "600",
    marginLeft: 4,
  },
  forgot: {
    alignSelf: "flex-end",
    paddingVertical: 4,
  },
  forgotText: {
    color: authColors.sub,
    fontSize: TYPE.caption.fontSize,
    fontWeight: "600",
  },
  dimmed: {
    opacity: 0.55,
  },
  ctaBlock: {
    gap: 14,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: authColors.border,
  },
  dividerText: {
    color: authColors.sub,
    fontSize: TYPE.caption.fontSize,
    fontWeight: "500",
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: authColors.borderSoft,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  googleButton: {
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  socialButtonText: {
    color: "#fff",
    fontSize: TYPE.body.fontSize,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingTop: 4,
  },
  footerText: {
    color: authColors.sub,
    fontSize: TYPE.caption.fontSize,
  },
  footerLink: {
    color: palette.accent,
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
  },
});
