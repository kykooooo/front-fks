// services/socialAuth.ts
// Social authentication (Google + Apple Sign-In)
import { Platform } from "react-native";
import { getAuth, signInWithCredential, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";

// ─── Apple Sign-In ──────────────────────────────────────────────

export async function signInWithApple(): Promise<{ isNewUser: boolean }> {
  const nonce = Math.random().toString(36).substring(2, 10);
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    nonce
  );

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) {
    throw new Error("Apple Sign-In: no identity token");
  }

  const oauthCredential = new OAuthProvider("apple.com").credential({
    idToken: credential.identityToken,
    rawNonce: nonce,
  });

  const auth = getAuth();
  const result = await signInWithCredential(auth, oauthCredential);
  const user = result.user;

  // Check if profile exists
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const isNewUser = !snap.exists() || snap.data()?.profileCompleted !== true;

  if (!snap.exists()) {
    // Create initial Firestore doc
    const firstName =
      credential.fullName?.givenName ??
      user.displayName?.split(" ")[0] ??
      "";
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email ?? "",
      firstName,
      displayName: user.displayName ?? firstName,
      profileCompleted: false,
      authProvider: "apple",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return { isNewUser };
}

export function isAppleSignInAvailable(): boolean {
  return Platform.OS === "ios";
}

// ─── Google Sign-In ─────────────────────────────────────────────

let googleConfigured = false;

export function configureGoogleSignIn(webClientId: string) {
  try {
    const { GoogleSignin } = require("@react-native-google-signin/google-signin");
    GoogleSignin.configure({ webClientId });
    googleConfigured = true;
  } catch {
    googleConfigured = false;
  }
}

export async function signInWithGoogle(): Promise<{ isNewUser: boolean }> {
  if (!googleConfigured) {
    throw new Error("Google Sign-In not configured");
  }

  const { GoogleSignin } = require("@react-native-google-signin/google-signin");
  await GoogleSignin.hasPlayServices();
  const signInResult = await GoogleSignin.signIn();
  const idToken = signInResult?.data?.idToken;

  if (!idToken) {
    throw new Error("Google Sign-In: no ID token");
  }

  const googleCredential = GoogleAuthProvider.credential(idToken);
  const auth = getAuth();
  const result = await signInWithCredential(auth, googleCredential);
  const user = result.user;

  // Check if profile exists
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const isNewUser = !snap.exists() || snap.data()?.profileCompleted !== true;

  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email ?? "",
      firstName: user.displayName?.split(" ")[0] ?? "",
      displayName: user.displayName ?? "",
      profileCompleted: false,
      authProvider: "google",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return { isNewUser };
}

export function isGoogleSignInAvailable(): boolean {
  return googleConfigured;
}
