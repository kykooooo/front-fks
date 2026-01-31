// src/screens/LoginScreen.tsx
import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../navigation/RootNavigator";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../services/firebase";
import { DEV_FLAGS } from "../config/devFlags";
import { theme } from "../constants/theme";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { showError } from "../utils/errorHandler";
import { trackEvent } from "../services/analytics";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

const palette = theme.colors;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!email || !pwd) {
      Alert.alert("Champs manquants", "Entre ton email et ton mot de passe.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pwd);
      trackEvent("login_success");
    } catch (e: any) {
      trackEvent("login_failed", { code: e?.code ?? "unknown" });
      showError(e, "Connexion");
    } finally {
      setLoading(false);
    }
  };

  const onForgot = async () => {
    if (!email) {
      Alert.alert("Email requis", "Entre ton email pour recevoir le lien.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert("Email envoyé", "Vérifie ta boîte mail pour réinitialiser ton mot de passe.");
    } catch (e: any) {
      showError(e, "Réinitialisation mot de passe");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Bienvenue 👋</Text>
          <Text style={styles.subtitle}>Reprends ta prépa là où tu l’as laissée.</Text>
        </View>

        <Card variant="surface" style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            placeholder="email@exemple.com"
            placeholderTextColor={palette.sub}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            accessibilityLabel="Champ email"
            accessibilityHint="Entre ton adresse email pour te connecter"
          />
          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            placeholder="••••••••"
            placeholderTextColor={palette.sub}
            secureTextEntry
            value={pwd}
            onChangeText={setPwd}
            style={styles.input}
            accessibilityLabel="Champ mot de passe"
            accessibilityHint="Entre ton mot de passe"
          />

          <Button
            label={loading ? "Connexion..." : "Se connecter"}
            onPress={onLogin}
            disabled={loading}
            fullWidth
            size="lg"
          />

          <Pressable
            onPress={onForgot}
            style={styles.forgot}
            accessibilityLabel="Mot de passe oublié"
            accessibilityHint="Appuie pour recevoir un email de réinitialisation"
            accessibilityRole="button"
          >
            <Text style={styles.forgotText}>Mot de passe oublié</Text>
          </Pressable>
        </Card>

        <Pressable
          onPress={() => navigation.navigate("Register")}
          style={styles.footerLink}
          accessibilityLabel="Aller à l'inscription"
          accessibilityHint="Appuie pour créer un nouveau compte"
          accessibilityRole="button"
        >
          <Text style={styles.footerText}>
            Pas de compte ? <Text style={styles.footerHighlight}>Inscription</Text>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    gap: 16,
  },
  header: { gap: 6 },
  title: { fontSize: 28, fontWeight: "800", color: palette.text },
  subtitle: { fontSize: 14, color: palette.sub },
  card: { padding: 16, gap: 12 },
  label: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: palette.sub,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: palette.text,
    backgroundColor: palette.cardSoft,
  },
  forgot: { alignItems: "center", marginTop: 6 },
  forgotText: { color: palette.sub, fontSize: 13 },
  footerLink: { alignItems: "center" },
  footerText: { color: palette.sub, fontSize: 14 },
  footerHighlight: { color: palette.accent, fontWeight: "700" },
});
