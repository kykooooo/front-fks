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
import { theme } from "../constants/theme";

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
      showToast({ type: "warn", title: "Email invalide", message: "Vérifie le format avant de continuer." });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, emailTrimmed);
      showToast({
        type: "success",
        title: "Email envoyé",
        message: "Vérifie ta boîte mail pour réinitialiser ton mot de passe.",
      });
    } catch (e: any) {
      showError(e, "Réinitialisation mot de passe");
      showToast({
        type: "error",
        title: "Erreur",
        message: "Impossible d'envoyer l'email de réinitialisation.",
      });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={palette.bg} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Back */}
            {navigation.canGoBack() ? (
              <Pressable onPress={() => navigation.goBack()} style={styles.back}>
                <Ionicons name="chevron-back" size={24} color={palette.sub} />
              </Pressable>
            ) : null}

            {/* Logo */}
            <Text style={styles.logo}>FKS</Text>

            {/* Header */}
            <Text style={styles.title}>Content de te revoir</Text>
            <Text style={styles.subtitle}>Connecte-toi pour reprendre ta progression.</Text>

            {/* Form */}
            <Animated.View style={[styles.form, { transform: [{ translateX: shake }] }]}>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={palette.muted} style={styles.inputIcon} />
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
                <Ionicons name="lock-closed-outline" size={18} color={palette.muted} style={styles.inputIcon} />
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
                <Pressable onPress={() => setShowPwd(!showPwd)} style={styles.eye}>
                  <Ionicons
                    name={showPwd ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={palette.muted}
                  />
                </Pressable>
              </View>

              <Pressable
                onPress={onForgot}
                disabled={loading}
                style={[styles.forgot, loading && { opacity: 0.5 }]}
              >
                <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
              </Pressable>

              <Pressable
                onPress={onLogin}
                disabled={loading || !canSubmit}
                style={({ pressed }) => [
                  styles.cta,
                  pressed && styles.ctaPressed,
                  (loading || !canSubmit) && styles.ctaDisabled,
                ]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.ctaText}>Se connecter</Text>
                )}
              </Pressable>
            </Animated.View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Pas de compte ?</Text>
              <Pressable onPress={() => navigation.navigate("Register")}>
                <Text style={styles.footerLink}>Inscris-toi</Text>
              </Pressable>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  scroll: { flexGrow: 1, paddingHorizontal: 24, justifyContent: "center", gap: 8 },
  back: { alignSelf: "flex-start", padding: 8, marginBottom: 16 },
  logo: { fontSize: 28, fontWeight: "900", color: palette.text, letterSpacing: 3, textAlign: "center" },
  title: { fontSize: 24, fontWeight: "800", color: palette.text, textAlign: "center", marginTop: 24 },
  subtitle: { fontSize: 14, color: palette.sub, textAlign: "center", marginBottom: 24 },
  form: { gap: 12 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, color: palette.text, fontSize: 15 },
  eye: { padding: 4 },
  error: { color: palette.danger, fontSize: 12, fontWeight: "600", marginLeft: 4 },
  forgot: { alignSelf: "flex-end" },
  forgotText: { color: palette.sub, fontSize: 13, fontWeight: "600" },
  cta: {
    backgroundColor: palette.accent,
    borderRadius: theme.radius.pill,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    ...theme.shadow.accent,
  },
  ctaPressed: { transform: [{ scale: 0.96 }] },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  footer: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 32, paddingVertical: 16 },
  footerText: { color: palette.sub, fontSize: 14 },
  footerLink: { color: palette.accent, fontSize: 14, fontWeight: "700" },
});
