// screens/RegisterScreen.tsx
// Inscription — 3 champs, même DA que l'app

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
import { createUserWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { showError } from "../utils/errorHandler";
import { showToast } from "../utils/toast";
import { useHaptics } from "../hooks/useHaptics";
import { runShake } from "../utils/animations";
import { theme } from "../constants/theme";

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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
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
      fail("Mot de passe trop court", "Minimum 6 caractères.");
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
      // Déconnecter pour que l'utilisateur passe par Login
      await signOut(auth);
      haptics.success();
      showToast({ type: "success", title: "Compte créé", message: "Connecte-toi pour continuer." });
      // Le signOut déclenche le re-render vers AuthStack automatiquement
      // navigation.navigate("Login") n'est plus nécessaire
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

  const pwdStrength = pwd.length === 0 ? 0 : pwd.length < 6 ? 1 : pwd.length < 10 ? 2 : 3;
  const strengthColors = ["transparent", palette.danger, palette.warn, palette.success];
  const strengthLabels = ["", "Faible", "Moyen", "Fort"];

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
            <Pressable onPress={() => navigation.goBack()} style={styles.back}>
              <Ionicons name="chevron-back" size={24} color={palette.sub} />
            </Pressable>

            <Text style={styles.title}>Crée ton compte</Text>
            <Text style={styles.subtitle}>30 secondes, promis.</Text>

            <Animated.View style={[styles.form, { transform: [{ translateX: shake }] }]}>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={18} color={palette.muted} style={styles.icon} />
                <TextInput
                  placeholder="Prénom"
                  placeholderTextColor={palette.muted}
                  value={name}
                  onChangeText={setName}
                  autoComplete="name"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                  style={styles.input}
                />
              </View>

              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={palette.muted} style={styles.icon} />
                <TextInput
                  ref={emailRef}
                  placeholder="Email"
                  placeholderTextColor={palette.muted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  value={email}
                  onChangeText={setEmail}
                  returnKeyType="next"
                  onSubmitEditing={() => pwdRef.current?.focus()}
                  style={styles.input}
                />
              </View>
              {email.length > 0 && !emailLooksValid ? (
                <Text style={styles.error}>Format email invalide</Text>
              ) : null}

              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={palette.muted} style={styles.icon} />
                <TextInput
                  ref={pwdRef}
                  placeholder="Mot de passe"
                  placeholderTextColor={palette.muted}
                  secureTextEntry={!showPwd}
                  autoComplete="new-password"
                  value={pwd}
                  onChangeText={setPwd}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (!loading && canSubmit) void onRegister();
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

              <Pressable
                onPress={onRegister}
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
                  <Text style={styles.ctaText}>Suivant</Text>
                )}
              </Pressable>
            </Animated.View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Déjà un compte ?</Text>
              <Pressable onPress={() => navigation.navigate("Login")}>
                <Text style={styles.footerLink}>Connecte-toi</Text>
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
  title: { fontSize: 24, fontWeight: "800", color: palette.text, textAlign: "center" },
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
  icon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, color: palette.text, fontSize: 15 },
  eye: { padding: 4 },
  error: { color: palette.danger, fontSize: 12, fontWeight: "600", marginLeft: 4 },
  strengthRow: { flexDirection: "row", alignItems: "center", gap: 10, marginLeft: 4 },
  strengthBars: { flexDirection: "row", gap: 4 },
  strengthBar: { width: 32, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: "600" },
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
