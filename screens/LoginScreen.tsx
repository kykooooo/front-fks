// screens/LoginScreen.tsx
// Connexion — Nike TC × Strava design

import React, { useRef, useState } from "react";
import {
  AccessibilityInfo,
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
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../services/firebase";
import { showError } from "../utils/errorHandler";
import { trackEvent } from "../services/analytics";
import { showToast } from "../utils/toast";
import { useHaptics } from "../hooks/useHaptics";
import { runShake } from "../utils/animations";
import { ds, typo, space, radius, anim } from "../theme/authDesignSystem";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

const getLoginErrorMessage = (code?: string) => {
  switch (code) {
    case "auth/invalid-email":
      return "Email invalide.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email ou mot de passe incorrect.";
    case "auth/too-many-requests":
      return "Trop de tentatives. R\u00e9essaie dans quelques minutes.";
    case "auth/network-request-failed":
      return "Probl\u00e8me r\u00e9seau. V\u00e9rifie ta connexion.";
    default:
      return "V\u00e9rifie tes informations puis r\u00e9essaie.";
  }
};

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;
  const pwdRef = useRef<TextInput>(null);
  const haptics = useHaptics();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailTrimmed = email.trim();
  const emailOk = emailRegex.test(emailTrimmed);
  const canSubmit = emailOk && pwd.length > 0;

  const safeShake = () => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!reduced) runShake(shake);
    });
  };

  const onLogin = async () => {
    if (!email || !pwd) {
      showToast({ type: "warn", title: "Champs manquants", message: "Email et mot de passe requis." });
      safeShake();
      haptics.warning();
      return;
    }
    if (!emailOk) {
      showToast({ type: "warn", title: "Email invalide", message: "V\u00e9rifie le format de ton email." });
      safeShake();
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
      safeShake();
      haptics.error();
      showToast({
        type: "error",
        title: "Connexion \u00e9chou\u00e9e",
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
    if (!emailOk) {
      showToast({ type: "warn", title: "Email invalide", message: "V\u00e9rifie le format avant de continuer." });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, emailTrimmed);
      showToast({
        type: "success",
        title: "Email envoy\u00e9",
        message: "V\u00e9rifie ta bo\u00eete mail pour r\u00e9initialiser ton mot de passe.",
      });
    } catch (e: any) {
      showError(e, "R\u00e9initialisation mot de passe");
      showToast({
        type: "error",
        title: "Erreur",
        message: "Impossible d'envoyer l'email de r\u00e9initialisation.",
      });
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={ds.bg} />
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView
              contentContainerStyle={s.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Back */}
              {navigation.canGoBack() && (
                <Pressable
                  onPress={() => navigation.goBack()}
                  style={s.back}
                  accessibilityLabel="Retour"
                  accessibilityRole="button"
                >
                  <Ionicons name="chevron-back" size={24} color={ds.textSecondary} />
                </Pressable>
              )}

              {/* Brand */}
              <View style={s.brandRow}>
                <Text style={s.brand}>FKS</Text>
                <View style={s.signatureBar} />
              </View>

              {/* Header */}
              <View style={s.header}>
                <Text style={s.title}>Content de te revoir.</Text>
                <Text style={s.subtitle}>Connecte-toi pour reprendre ta progression.</Text>
              </View>

              {/* Form */}
              <Animated.View style={[s.form, { transform: [{ translateX: shake }] }]}>
                {/* Email */}
                <View style={s.field}>
                  <Text style={s.label}>EMAIL</Text>
                  <View style={s.inputWrap}>
                    <Ionicons name="mail-outline" size={18} color={ds.textTertiary} style={s.inputIcon} />
                    <TextInput
                      placeholder="Ton email"
                      placeholderTextColor={ds.textTertiary}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoComplete="email"
                      value={email}
                      onChangeText={setEmail}
                      returnKeyType="next"
                      onSubmitEditing={() => pwdRef.current?.focus()}
                      style={s.input}
                      accessibilityLabel="Champ email"
                    />
                  </View>
                  {email.length > 0 && !emailOk && (
                    <Text style={s.error}>Format email invalide.</Text>
                  )}
                </View>

                {/* Password */}
                <View style={s.field}>
                  <Text style={s.label}>MOT DE PASSE</Text>
                  <View style={s.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color={ds.textTertiary} style={s.inputIcon} />
                    <TextInput
                      ref={pwdRef}
                      placeholder="Ton mot de passe"
                      placeholderTextColor={ds.textTertiary}
                      secureTextEntry={!showPwd}
                      autoComplete="password"
                      value={pwd}
                      onChangeText={setPwd}
                      returnKeyType="go"
                      onSubmitEditing={() => {
                        if (!loading && canSubmit) void onLogin();
                      }}
                      style={s.input}
                      accessibilityLabel="Champ mot de passe"
                    />
                    <Pressable
                      onPress={() => setShowPwd(!showPwd)}
                      style={s.eyeBtn}
                      accessibilityLabel={showPwd ? "Masquer mot de passe" : "Afficher mot de passe"}
                    >
                      <Ionicons
                        name={showPwd ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={ds.textTertiary}
                      />
                    </Pressable>
                  </View>
                </View>

                {/* Forgot */}
                <Pressable
                  onPress={onForgot}
                  disabled={loading}
                  style={[s.forgot, loading && { opacity: 0.5 }]}
                  accessibilityLabel="Mot de passe oubli\u00e9"
                  accessibilityRole="button"
                >
                  <Text style={s.forgotText}>Mot de passe oubli\u00e9 ?</Text>
                </Pressable>

                {/* Submit */}
                <View style={{ height: space.sm }} />
                <Pressable
                  onPress={onLogin}
                  disabled={loading || !canSubmit}
                  style={({ pressed }) => [
                    s.cta,
                    pressed && s.ctaPressed,
                    (loading || !canSubmit) && s.ctaDisabled,
                  ]}
                  accessibilityLabel="Se connecter"
                  accessibilityRole="button"
                >
                  <LinearGradient
                    colors={loading || !canSubmit ? [...ds.gradientDisabled] : [...ds.gradientAccent]}
                    style={s.ctaInner}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <View style={s.loadingRow}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={s.ctaText}>Connexion...</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={s.ctaText}>Se connecter</Text>
                        <Ionicons name="arrow-forward" size={18} color={ds.textOnAccent} />
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              </Animated.View>

              {/* Footer */}
              <View style={s.footer}>
                <Text style={s.footerText}>
                  Pas encore de compte ?{" "}
                  <Text
                    style={s.footerLink}
                    onPress={() => navigation.navigate("Register")}
                    accessibilityLabel="S'inscrire"
                    accessibilityRole="button"
                  >
                    Inscris-toi
                  </Text>
                </Text>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ds.bg,
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: space.screenH,
    paddingBottom: space.xxl,
    justifyContent: "center",
    gap: space.sectionGap,
  },
  back: {
    alignSelf: "flex-start",
    padding: space.sm,
  },
  brandRow: {
    alignItems: "center",
    gap: 8,
  },
  brand: {
    color: ds.text,
    ...typo.brand,
  },
  signatureBar: {
    width: 40,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: ds.accent,
  },
  header: {
    gap: space.sm,
  },
  title: {
    color: ds.text,
    ...typo.title,
  },
  subtitle: {
    color: ds.textSecondary,
    ...typo.subtitle,
  },
  form: {
    gap: space.inputGap,
  },
  field: {
    gap: space.sm,
  },
  label: {
    color: ds.textSecondary,
    ...typo.sectionLabel,
    marginLeft: 4,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    backgroundColor: ds.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: ds.border,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: ds.text,
    ...typo.body,
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 4,
  },
  error: {
    color: ds.error,
    ...typo.caption,
    marginLeft: 4,
  },
  forgot: {
    alignSelf: "flex-end",
  },
  forgotText: {
    color: ds.accent,
    ...typo.caption,
    fontWeight: "600",
  },

  // CTA
  cta: {
    height: 56,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  ctaPressed: {
    opacity: anim.pressOpacity,
    transform: [{ scale: anim.pressScale }],
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  ctaText: {
    color: ds.textOnAccent,
    ...typo.button,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  // Footer
  footer: {
    alignItems: "center",
    paddingVertical: space.lg,
  },
  footerText: {
    color: ds.textSecondary,
    ...typo.body,
  },
  footerLink: {
    color: ds.accent,
    fontWeight: "700",
  },
});
