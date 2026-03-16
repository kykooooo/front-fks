// screens/RegisterScreen.tsx
// Inscription — image de foot en fond, même DA que le reste de l'app

import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
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
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { showError } from "../utils/errorHandler";
import { showToast } from "../utils/toast";
import { useHaptics } from "../hooks/useHaptics";
import { runFadeIn, runShake, runSlideUp } from "../utils/animations";
import { theme } from "../constants/theme";
import { AuthBackground, AUTH_IMAGES } from "../components/auth/AuthBackground";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;
const palette = theme.colors;

const getRegisterErrorMessage = (code?: string) => {
  switch (code) {
    case "auth/invalid-email":
      return "Email invalide.";
    case "auth/email-already-in-use":
      return "Cet email est déjà utilisé.";
    case "auth/weak-password":
      return "Mot de passe trop faible (minimum 6 caractères).";
    case "auth/network-request-failed":
      return "Problème réseau. Vérifie ta connexion.";
    case "auth/too-many-requests":
      return "Trop de tentatives. Réessaie dans quelques minutes.";
    default:
      return "Vérifie tes infos et réessaie.";
  }
};

export default function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const haptics = useHaptics();
  const shake = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(0)).current;
  const emailInputRef = useRef<TextInput>(null);
  const pwdInputRef = useRef<TextInput>(null);
  const confirmInputRef = useRef<TextInput>(null);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailTrimmed = email.trim();
  const emailLooksValid = emailRegex.test(emailTrimmed);
  const canSubmit =
    emailLooksValid &&
    pwd.length >= 6 &&
    confirm.length > 0 &&
    pwd === confirm;

  useEffect(() => {
    runFadeIn(fadeIn);
    runSlideUp(slideUp);
  }, [fadeIn, slideUp]);

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
      fail("Email invalide", "Entre une adresse email valide (ex: nom@exemple.com).");
      return;
    }
    if (pwd.length < 6) {
      fail("Mot de passe trop court", "Minimum 6 caractères.");
      return;
    }
    if (pwd !== confirm) {
      fail("Mots de passe différents", "Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const cleanDisplayName = displayName.trim();
      const cred = await createUserWithEmailAndPassword(auth, emailTrimmed, pwd);
      if (cleanDisplayName) {
        await updateProfile(cred.user, { displayName: cleanDisplayName });
      }
      const userRef = doc(db, "users", cred.user.uid);
      await setDoc(
        userRef,
        {
          email: cred.user.email ?? emailTrimmed,
          displayName: cleanDisplayName || cred.user.displayName || emailTrimmed.split("@")[0],
          profileCompleted: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      haptics.success();
      showToast({
        type: "success",
        title: "Compte créé",
        message: "Bienvenue dans FKS.",
      });
    } catch (e: any) {
      showError(e, "Inscription");
      runShake(shake);
      haptics.error();
      showToast({
        type: "error",
        title: "Inscription échouée",
        message: getRegisterErrorMessage(e?.code),
      });
    } finally {
      setLoading(false);
    }
  };

  // Password strength indicator
  const pwdStrength = pwd.length === 0 ? 0 : pwd.length < 6 ? 1 : pwd.length < 10 ? 2 : 3;
  const strengthColors = ["transparent", palette.danger, palette.warn, palette.success];
  const strengthLabels = ["", "Faible", "Moyen", "Fort"];

  return (
    <AuthBackground image={AUTH_IMAGES.register}>
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
              <Pressable
                onPress={() => navigation.goBack()}
                style={styles.backButton}
                accessibilityLabel="Retour"
                accessibilityRole="button"
              >
                <Ionicons name="arrow-back" size={24} color={palette.text} />
              </Pressable>

              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerIcon}>
                  <LinearGradient
                    colors={["#ff7a1a", "#ff9a4a"]}
                    style={styles.headerIconGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="person-add-outline" size={28} color="#fff" />
                  </LinearGradient>
                </View>
                <Text style={styles.title}>Créer un compte</Text>
                <Text style={styles.subtitle}>Crée ton compte pour démarrer ta progression.</Text>
              </View>

              {/* Form */}
              <Animated.View
                style={[
                  styles.formContainer,
                  {
                    opacity: fadeIn,
                    transform: [
                      { translateX: shake },
                      {
                        translateY: slideUp.interpolate({
                          inputRange: [0, 1],
                          outputRange: [16, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {/* Display Name */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Prénom ou surnom</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={18} color={palette.muted} style={styles.inputIcon} />
                    <TextInput
                      placeholder="Ex: Karim"
                      placeholderTextColor={palette.muted}
                      value={displayName}
                      onChangeText={setDisplayName}
                      autoComplete="name"
                      returnKeyType="next"
                      onSubmitEditing={() => emailInputRef.current?.focus()}
                      style={styles.input}
                      accessibilityLabel="Champ prénom"
                    />
                  </View>
                </View>

                {/* Email */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={18} color={palette.muted} style={styles.inputIcon} />
                    <TextInput
                      ref={emailInputRef}
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
                    />
                  </View>
                  {email.length > 0 && !emailLooksValid ? (
                    <Text style={styles.errorText}>Format email invalide</Text>
                  ) : null}
                </View>

                {/* Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Mot de passe</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={18} color={palette.muted} style={styles.inputIcon} />
                    <TextInput
                      ref={pwdInputRef}
                      placeholder="Minimum 6 caractères"
                      placeholderTextColor={palette.muted}
                      secureTextEntry={!showPwd}
                      autoComplete="new-password"
                      value={pwd}
                      onChangeText={setPwd}
                      returnKeyType="next"
                      onSubmitEditing={() => confirmInputRef.current?.focus()}
                      style={styles.input}
                      accessibilityLabel="Champ mot de passe"
                    />
                    <Pressable
                      onPress={() => setShowPwd(!showPwd)}
                      style={styles.eyeButton}
                      accessibilityLabel={showPwd ? "Masquer" : "Afficher"}
                    >
                      <Ionicons
                        name={showPwd ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={palette.muted}
                      />
                    </Pressable>
                  </View>
                  {/* Strength indicator */}
                  {pwd.length > 0 ? (
                    <View style={styles.strengthRow}>
                      <View style={styles.strengthBars}>
                        {[1, 2, 3].map((level) => (
                          <View
                            key={level}
                            style={[
                              styles.strengthBar,
                              { backgroundColor: pwdStrength >= level ? strengthColors[pwdStrength] : palette.borderSoft },
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

                {/* Confirm Password */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirmer le mot de passe</Text>
                  <View style={[
                    styles.inputWrapper,
                    confirm.length > 0 && pwd !== confirm && styles.inputError,
                    confirm.length > 0 && pwd === confirm && styles.inputSuccess,
                  ]}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={palette.muted} style={styles.inputIcon} />
                    <TextInput
                      ref={confirmInputRef}
                      placeholder="Confirme ton mot de passe"
                      placeholderTextColor={palette.muted}
                      secureTextEntry={!showConfirm}
                      autoComplete="new-password"
                      value={confirm}
                      onChangeText={setConfirm}
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        if (!loading && canSubmit) void onRegister();
                      }}
                      style={styles.input}
                      accessibilityLabel="Champ confirmation"
                    />
                    <Pressable
                      onPress={() => setShowConfirm(!showConfirm)}
                      style={styles.eyeButton}
                    >
                      <Ionicons
                        name={showConfirm ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={palette.muted}
                      />
                    </Pressable>
                  </View>
                  {confirm.length > 0 && pwd !== confirm ? (
                    <Text style={styles.errorText}>Les mots de passe ne correspondent pas</Text>
                  ) : null}
                </View>

                {/* Register button */}
                <Pressable
                  onPress={onRegister}
                  disabled={loading || !canSubmit}
                  style={({ pressed }) => [
                    styles.registerButton,
                    pressed && styles.registerButtonPressed,
                    (loading || !canSubmit) && styles.registerButtonDisabled,
                  ]}
                  accessibilityLabel="S'inscrire"
                  accessibilityRole="button"
                >
                  <LinearGradient
                    colors={loading ? ["#666", "#555"] : ["#ff7a1a", "#ff9a4a"]}
                    style={styles.registerButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <View style={styles.loadingRow}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.registerButtonText}>Création en cours...</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.registerButtonText}>Créer mon compte</Text>
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              </Animated.View>

              {/* Footer */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>Déjà un compte ?</Text>
                <Pressable
                  onPress={() => navigation.navigate("Login")}
                  style={styles.loginLink}
                  accessibilityLabel="Se connecter"
                  accessibilityRole="button"
                >
                  <Text style={styles.loginLinkText}>Se connecter</Text>
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
  container: {
    flexGrow: 1,
    padding: 24,
    gap: 20,
  },
  backButton: {
    alignSelf: "flex-start",
    padding: 4,
    marginBottom: 8,
  },
  header: {
    alignItems: "center",
    gap: 8,
  },
  headerIcon: {
    marginBottom: 8,
    ...theme.shadow.accent,
  },
  headerIconGradient: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 26,
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
  inputError: {
    borderColor: palette.danger,
  },
  inputSuccess: {
    borderColor: palette.success,
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
  eyeButton: {
    padding: 4,
  },
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
    marginLeft: 4,
  },
  strengthBars: {
    flexDirection: "row",
    gap: 4,
  },
  strengthBar: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  errorText: {
    color: palette.danger,
    fontSize: 12,
    marginLeft: 4,
    marginTop: 4,
    fontWeight: "600",
  },
  registerButton: {
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    marginTop: 8,
    ...theme.shadow.accent,
  },
  registerButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  registerButtonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  registerButtonGradient: {
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
  registerButtonText: {
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
  loginLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  loginLinkText: {
    color: palette.accent,
    fontSize: 15,
    fontWeight: "700",
  },
});
