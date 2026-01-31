// src/screens/RegisterScreen.tsx
import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../navigation/RootNavigator";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { DEV_FLAGS } from "../config/devFlags";
import { theme } from "../constants/theme";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { showError } from "../utils/errorHandler";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

const palette = theme.colors;

export default function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const onRegister = async () => {
    if (!email || !pwd) {
      Alert.alert("Champs manquants", "Email et mot de passe sont requis.");
      return;
    }
    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert("Email invalide", "Entre une adresse email valide (ex: nom@exemple.com).");
      return;
    }
    if (pwd.length < 6) {
      Alert.alert("Mot de passe trop court", "Minimum 6 caractères.");
      return;
    }
    if (pwd !== confirm) {
      Alert.alert("Non concordance", "Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pwd);
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }
      // Crée le doc utilisateur Firestore pour isoler les données
      const userRef = doc(db, "users", cred.user.uid);
      await setDoc(
        userRef,
        {
          email: cred.user.email ?? email.trim(),
          displayName: displayName || cred.user.displayName || email.trim().split("@")[0],
          profileCompleted: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      // onAuthStateChanged basculera vers RootNavigator
    } catch (e: any) {
      showError(e, "Inscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Rejoins la prépa FKS, prends l’avantage.</Text>
        </View>

        <Card variant="surface" style={styles.card}>
          <Text style={styles.label}>Nom à afficher</Text>
          <TextInput
            placeholder="Ex: Karim"
            placeholderTextColor={palette.sub}
            value={displayName}
            onChangeText={setDisplayName}
            style={styles.input}
            accessibilityLabel="Champ nom d'affichage"
            accessibilityHint="Optionnel. Entre ton prénom ou surnom"
          />

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
            accessibilityHint="Entre une adresse email valide pour créer ton compte"
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
            accessibilityHint="Minimum 6 caractères"
          />
          <Text style={styles.label}>Confirmer le mot de passe</Text>
          <TextInput
            placeholder="••••••••"
            placeholderTextColor={palette.sub}
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
            style={styles.input}
            accessibilityLabel="Champ confirmation mot de passe"
            accessibilityHint="Resaisis ton mot de passe pour confirmation"
          />

          <Button
            label={loading ? "Création..." : "S'inscrire"}
            onPress={onRegister}
            disabled={loading}
            fullWidth
            size="lg"
          />
        </Card>

        <Pressable
          onPress={() => navigation.navigate("Login")}
          style={styles.footerLink}
          accessibilityLabel="Aller à la connexion"
          accessibilityHint="Appuie si tu as déjà un compte"
          accessibilityRole="button"
        >
          <Text style={styles.footerText}>
            Déjà un compte ? <Text style={styles.footerHighlight}>Connexion</Text>
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
  title: { fontSize: 26, fontWeight: "800", color: palette.text },
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
  footerLink: { alignItems: "center" },
  footerText: { color: palette.sub, fontSize: 14 },
  footerHighlight: { color: palette.accent, fontWeight: "700" },
});
