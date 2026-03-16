// screens/LoginScreen.tsx
// Login — image de foot en fond, même DA que le reste de l'app

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
import { theme } from "../constants/theme";
import { AuthBackground, AUTH_IMAGES } from "../components/auth/AuthBackground";

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
    <AuthBackground image={AUTH_IMAGES.welcome}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView
              contentContainerStyle={styles.container}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Back button */}
              {navigation.canGoBack() ? (
                <Pressable
                  onPress={() => navigation.goBack()}
                  style={styles.backButton}
                  accessibilityLabel="Retour"
                  accessibilityRole="button"
                >
                  <Ionicons name="chevron-back" size={24} color={palette.sub} />
                </Pressable>
              ) : null}

              {/* Logo / Brand */}
              <View style={styles.brandSection}>
                <View style={styles.logoContainer}>
                  <LinearGradient
                    colors={["#ff7a1a", "#ff9a4a"]}
                    style={styles.logoGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="fitness-outline" size={32} color="#fff" />
                  </LinearGradient>
                </View>
                <Text style={styles.brandName}>FKS</Text>
              </View>

              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Content de te revoir</Text>
                <Text style={styles.subtitle}>Connecte-toi pour reprendre ta progression.</Text>
              </View>

              {/* Form */}
              <Animated.View style={[styles.formContainer, { transform: [{ translateX: shake }] }]}>
                {/* Email */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={18} color={palette.muted} style={styles.inputIcon} />
                    <TextInput
                      placeholder="ton@email.com"
                      placeholderTextColor={palette.muted}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoComplete="email"
                      value={email}
                      onChangeText={setEmail}
                      returnKeyType="next"
                      onSubmitEditing={() => pwdInputRef.current?.focus()}
                      style={styles.input}
                      accessibilityLabel="Champ email"
                      accessibilityHint="Entre ton adresse email pour te connecter"
                    />
                  </View>
                  {email.length > 0 && !emailLooksValid ? (
                    <Text style={styles.inlineError}>Format email invalide.</Text>
                  ) : null}
                </View>

                {/* Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Mot de passe</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={18} color={palette.muted} style={styles.inputIcon} />
                    <TextInput
                      ref={pwdInputRef}
                      placeholder="••••••••"
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
                      accessibilityLabel="Champ mot de passe"
                      accessibilityHint="Entre ton mot de passe"
                    />
                    <Pressable
                      onPress={() => setShowPwd(!showPwd)}
                      style={styles.eyeButton}
                      accessibilityLabel={showPwd ? "Masquer mot de passe" : "Afficher mot de passe"}
                    >
                      <Ionicons
                        name={showPwd ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={palette.muted}
                      />
                    </Pressable>
                  </View>
                </View>

                {/* Forgot password */}
                <Pressable
                  onPress={onForgot}
                  disabled={loading}
                  style={[styles.forgot, loading && styles.forgotDisabled]}
                  accessibilityLabel="Mot de passe oublié"
                  accessibilityRole="button"
                >
                  <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
                </Pressable>

                {/* Login button */}
                <Pressable
                  onPress={onLogin}
                  disabled={loading || !canSubmit}
                  style={({ pressed }) => [
                    styles.loginButton,
                    pressed && styles.loginButtonPressed,
                    (loading || !canSubmit) && styles.loginButtonDisabled,
                  ]}
                  accessibilityLabel="Se connecter"
                  accessibilityRole="button"
                >
                  <LinearGradient
                    colors={loading ? ["#666", "#555"] : ["#ff7a1a", "#ff9a4a"]}
                    style={styles.loginButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <View style={styles.loadingRow}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.loginButtonText}>Connexion...</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.loginButtonText}>Se connecter</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              </Animated.View>

              {/* Footer - Register link */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>Pas encore de compte ?</Text>
                <Pressable
                  onPress={() => navigation.navigate("Register")}
                  style={styles.registerLink}
                  accessibilityLabel="Créer un compte"
                  accessibilityRole="button"
                >
                  <Text style={styles.registerLinkText}>Créer un compte</Text>
                  <Ionicons name="chevron-forward" size={16} color={palette.accent} />
                </Pressable>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  backButton: {
    alignSelf: "flex-start",
    padding: 8,
    marginBottom: 4,
  },
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
    gap: 24,
  },
  brandSection: {
    alignItems: "center",
    gap: 8,
  },
  logoContainer: {
    ...theme.shadow.accent,
  },
  logoGradient: {
    width: 64,
    height: 64,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  brandName: {
    fontSize: 28,
    fontWeight: "900",
    color: palette.text,
    letterSpacing: 3,
  },
  header: {
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: palette.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: palette.sub,
    textAlign: "center",
  },
  formContainer: {
    gap: 16,
    padding: 16,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: palette.text,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: theme.radius.md,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: palette.text,
    fontSize: 15,
  },
  inlineError: {
    marginLeft: 4,
    marginTop: 2,
    fontSize: 12,
    color: palette.danger,
    fontWeight: "600",
  },
  eyeButton: {
    padding: 4,
  },
  forgot: {
    alignSelf: "flex-end",
  },
  forgotDisabled: {
    opacity: 0.6,
  },
  forgotText: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  loginButton: {
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    marginTop: 8,
    ...theme.shadow.accent,
  },
  loginButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  loginButtonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  loginButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  footer: {
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: theme.radius.lg,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  footerText: {
    color: palette.sub,
    fontSize: 14,
  },
  registerLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  registerLinkText: {
    color: palette.accent,
    fontSize: 15,
    fontWeight: "700",
  },
});
