// screens/RegisterScreen.tsx
// Inscription premium, alignee avec l'ambiance auth de FKS

import React, { useRef, useState } from "react";
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
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { AuthStackParamList } from "../navigation/RootNavigator";
import { auth, db } from "../services/firebase";
import { showError } from "../utils/errorHandler";
import { showToast } from "../utils/toast";
import { useHaptics } from "../hooks/useHaptics";
import { runShake } from "../utils/animations";
import { theme, TYPE, RADIUS } from "../constants/theme";
import { AuthBackground } from "../components/auth/AuthBackground";
import { PitchDecoration } from "../components/ui/PitchDecoration";
import { Button } from "../components/ui/Button";
import { signInWithApple, signInWithGoogle, isAppleSignInAvailable } from "../services/socialAuth";
import { trackEvent } from "../services/analytics";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

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

const getRegisterErrorMessage = (code?: string) => {
  switch (code) {
    case "auth/invalid-email":
      return "Email invalide.";
    case "auth/email-already-in-use":
      return "Cet email est deja utilise.";
    case "auth/weak-password":
      return "Mot de passe trop faible (minimum 6 caracteres).";
    case "auth/network-request-failed":
      return "Probleme reseau. Verifie ta connexion.";
    case "auth/too-many-requests":
      return "Trop de tentatives. Reessaie dans quelques minutes.";
    default:
      return "Verifie tes infos et reessaie.";
  }
};

export default function RegisterScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [focusedField, setFocusedField] = useState<"name" | "email" | "password" | null>(null);
  const haptics = useHaptics();
  const shake = useRef(new Animated.Value(0)).current;
  const emailRef = useRef<TextInput>(null);
  const pwdRef = useRef<TextInput>(null);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailTrimmed = email.trim();
  const emailLooksValid = emailRegex.test(emailTrimmed);
  const canSubmit = emailLooksValid && pwd.length >= 6;

  const fail = (title: string, message?: string) => {
    runShake(shake);
    haptics.warning();
    showToast({ type: "error", title, message });
  };

  const onRegister = async () => {
    if (!email || !pwd) {
      fail("Champs manquants", "Email et mot de passe sont requis.");
      return;
    }
    if (!emailLooksValid) {
      fail("Email invalide", "Entre une adresse email valide.");
      return;
    }
    if (pwd.length < 6) {
      fail("Mot de passe trop court", "Minimum 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const cleanName = name.trim();
      const cred = await createUserWithEmailAndPassword(auth, emailTrimmed, pwd);
      if (cleanName) {
        await updateProfile(cred.user, { displayName: cleanName });
      }
      await setDoc(
        doc(db, "users", cred.user.uid),
        {
          email: cred.user.email ?? emailTrimmed,
          displayName: cleanName || emailTrimmed.split("@")[0],
          firstName: cleanName || emailTrimmed.split("@")[0],
          profileCompleted: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      haptics.success();
      showToast({ type: "success", title: "Compte cree", message: "Complete ton profil pour continuer." });
    } catch (e: any) {
      showError(e, "Inscription");
      runShake(shake);
      haptics.error();
      showToast({
        type: "error",
        title: "Inscription echouee",
        message: getRegisterErrorMessage(e?.code),
      });
    } finally {
      setLoading(false);
    }
  };

  const onAppleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithApple();
      haptics.success();
      trackEvent("register_apple_success");
    } catch (e: any) {
      if (e?.code !== "ERR_REQUEST_CANCELED") {
        haptics.warning();
        const msg = e?.message ?? e?.code ?? "Erreur inconnue";
        console.error("[Apple Sign-In Error]", JSON.stringify({ code: e?.code, message: e?.message, stack: e?.stack?.slice(0, 200) }));
        showToast({ type: "error", title: "Connexion Apple", message: msg });
      }
    } finally {
      setLoading(false);
    }
  };

  const onGoogleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
      haptics.success();
      trackEvent("register_google_success");
    } catch (e: any) {
      haptics.warning();
      showToast({ type: "error", title: "Connexion Google", message: "Une erreur est survenue. Réessaie." });
    } finally {
      setLoading(false);
    }
  };

  const pwdStrength = pwd.length === 0 ? 0 : pwd.length < 6 ? 1 : pwd.length < 10 ? 2 : 3;
  const strengthColors = ["transparent", palette.danger, palette.warn, palette.success];
  const strengthLabels = ["", "Faible", "Moyen", "Fort"];
  const ctaLabel = loading ? "Creation..." : "Creer mon compte";

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
                <Pressable onPress={() => navigation.goBack()} style={styles.back}>
                  <Ionicons name="chevron-back" size={22} color={authColors.sub} />
                </Pressable>
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
                <Text style={styles.title}>Cree ton compte</Text>
                <Text style={styles.subtitle}>En 30 secondes</Text>
                <Text style={styles.subcopy}>
                  On pose ta base joueur maintenant, puis on t'envoie sur le setup pour construire une vraie methode.
                </Text>
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
                    <Text style={styles.formKicker}>Depart rapide</Text>
                    <Text style={styles.formHint}>
                      Ton compte, ton profil, puis ton premier cycle. Tout est pret pour t'amener au setup sans friction.
                    </Text>
                  </View>

                  <View style={styles.formFields}>
                    <View
                      style={[
                        styles.inputWrap,
                        focusedField === "name" && styles.inputWrapFocused,
                      ]}
                    >
                      <Ionicons
                        name="person-outline"
                        size={18}
                        color={focusedField === "name" ? palette.accent : authColors.muted}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        placeholder="Prenom"
                        placeholderTextColor={authColors.muted}
                        value={name}
                        onChangeText={setName}
                        autoComplete="name"
                        returnKeyType="next"
                        onFocus={() => setFocusedField("name")}
                        onBlur={() => setFocusedField((prev) => (prev === "name" ? null : prev))}
                        onSubmitEditing={() => emailRef.current?.focus()}
                        style={styles.input}
                      />
                    </View>

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
                        ref={emailRef}
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
                        onSubmitEditing={() => pwdRef.current?.focus()}
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
                        ref={pwdRef}
                        placeholder="Mot de passe"
                        placeholderTextColor={authColors.muted}
                        secureTextEntry={!showPwd}
                        autoComplete="new-password"
                        value={pwd}
                        onChangeText={setPwd}
                        returnKeyType="done"
                        onFocus={() => setFocusedField("password")}
                        onBlur={() => setFocusedField((prev) => (prev === "password" ? null : prev))}
                        onSubmitEditing={() => {
                          if (!loading && canSubmit) void onRegister();
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

                    {pwd.length > 0 ? (
                      <View style={styles.strengthRow}>
                        <View style={styles.strengthBars}>
                          {[1, 2, 3].map((level) => (
                            <View
                              key={level}
                              style={[
                                styles.strengthBar,
                                {
                                  backgroundColor:
                                    pwdStrength >= level ? strengthColors[pwdStrength] : authColors.borderSoft,
                                },
                              ]}
                            />
                          ))}
                        </View>
                        <Text style={[styles.strengthLabel, { color: strengthColors[pwdStrength] }]}>
                          {strengthLabels[pwdStrength]}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.ctaBlock}>
                    <Button
                      label={ctaLabel}
                      onPress={() => void onRegister()}
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
                      <Pressable style={styles.socialButton} onPress={() => void onAppleSignIn()} disabled={loading}>
                        <Ionicons name="logo-apple" size={20} color="#fff" />
                        <Text style={styles.socialButtonText}>Continuer avec Apple</Text>
                      </Pressable>
                    )}

                    <Pressable style={[styles.socialButton, styles.googleButton]} onPress={() => void onGoogleSignIn()} disabled={loading}>
                      <Ionicons name="logo-google" size={18} color="#fff" />
                      <Text style={styles.socialButtonText}>Continuer avec Google</Text>
                    </Pressable>

                    <View style={styles.footer}>
                      <Text style={styles.footerText}>Deja un compte ?</Text>
                      <Pressable onPress={() => navigation.navigate("Login")}>
                        <Text style={styles.footerLink}>Connecte-toi</Text>
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
  heroBlock: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 28,
    gap: 8,
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
    fontSize: TYPE.caption.fontSize,
    color: palette.accent,
    textAlign: "center",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  subcopy: {
    fontSize: TYPE.body.fontSize,
    color: authColors.sub,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 330,
    marginTop: 4,
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
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginLeft: 4,
  },
  strengthBars: {
    flexDirection: "row",
    gap: 4,
  },
  strengthBar: {
    width: 32,
    height: 4,
    borderRadius: RADIUS.xs,
  },
  strengthLabel: {
    fontSize: TYPE.caption.fontSize,
    fontWeight: "600",
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
