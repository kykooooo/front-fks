// src/screens/RegisterScreen.tsx
import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../navigation/RootNavigator";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { DEV_FLAGS } from "../config/devFlags";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

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
      if (DEV_FLAGS.ENABLED) {
        console.log("[AUTH] Register OK", cred.user?.uid);
        console.log("[AUTH] currentUser post-register", auth.currentUser?.uid);
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
      if (DEV_FLAGS.ENABLED) console.log("[AUTH] Register error", e?.code, e?.message);
      Alert.alert("Inscription échouée", e?.message ?? "Réessaie plus tard.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, gap: 12, justifyContent: "center" }}>
      <Text style={{ fontSize: 28, fontWeight: "700", marginBottom: 8 }}>
        Créer un compte
      </Text>

      <TextInput
        placeholder="Nom à afficher (optionnel)"
        value={displayName}
        onChangeText={setDisplayName}
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 12,
          padding: 12,
        }}
      />

      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 12,
          padding: 12,
        }}
      />
      <TextInput
        placeholder="Mot de passe"
        secureTextEntry
        value={pwd}
        onChangeText={setPwd}
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 12,
          padding: 12,
        }}
      />
      <TextInput
        placeholder="Confirmer le mot de passe"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 12,
          padding: 12,
        }}
      />

      <Pressable
        onPress={onRegister}
        disabled={loading}
        style={{
          backgroundColor: "#111",
          padding: 14,
          borderRadius: 12,
          opacity: loading ? 0.6 : 1,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>
          {loading ? "Création..." : "S'inscrire"}
        </Text>
      </Pressable>

      <Pressable onPress={() => navigation.navigate("Login")}>
        <Text style={{ textAlign: "center", marginTop: 8 }}>
          Déjà un compte ? <Text style={{ fontWeight: "700" }}>Connexion</Text>
        </Text>
      </Pressable>
    </View>
  );
}
