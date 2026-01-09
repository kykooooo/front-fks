// src/screens/LoginScreen.tsx
import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../navigation/RootNavigator";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "../services/firebase";
import { DEV_FLAGS } from "../config/devFlags";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!email || !pwd) {
      Alert.alert("Champs manquants", "Entre ton email et ton mot de passe.");
      return;
    }
    if (DEV_FLAGS.ENABLED) {
      console.log("[AUTH] Attempt login", email.trim());
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pwd);
      // Debug: vérifie le currentUser après login
      if (DEV_FLAGS.ENABLED) console.log("[AUTH] Login OK", auth.currentUser?.uid);
      // onAuthStateChanged dans App.tsx basculera vers RootNavigator
    } catch (e: any) {
      if (DEV_FLAGS.ENABLED) console.log("[AUTH] Login error", e?.code, e?.message);
      Alert.alert("Connexion échouée", e?.message ?? "Vérifie tes identifiants.");
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
      Alert.alert("Email envoyé", "Vérifie ta boîte mail.");
    } catch (e: any) {
      if (DEV_FLAGS.ENABLED) console.log("[AUTH] Reset error", e?.code, e?.message);
      Alert.alert("Erreur", e?.message ?? "Impossible d'envoyer le mail.");
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, gap: 12, justifyContent: "center" }}>
      <Text style={{ fontSize: 28, fontWeight: "700", marginBottom: 8 }}>
        Bienvenue 👋
      </Text>

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

      <Pressable
        onPress={onLogin}
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
          {loading ? "Connexion..." : "Se connecter"}
        </Text>
      </Pressable>

      <Pressable onPress={() => navigation.navigate("Register")}>
        <Text style={{ textAlign: "center", marginTop: 8 }}>
          Pas de compte ? <Text style={{ fontWeight: "700" }}>Inscription</Text>
        </Text>
      </Pressable>

      <Pressable onPress={onForgot}>
        <Text style={{ textAlign: "center", marginTop: 8, color: "#555" }}>
          Mot de passe oublié
        </Text>
      </Pressable>
    </View>
  );
}
