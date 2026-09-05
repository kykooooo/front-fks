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
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { showToast } from "../utils/toast";
import { useHaptics } from "../hooks/useHaptics";
import { runShake } from "../utils/animations";
import { theme } from "../constants/theme";
import { trackEvent } from "../services/analytics";
import { STORAGE_KEYS } from "../constants/storage";
import { Screen } from "../components/ui/Screen";
import { Button } from "../components/ui/Button";
import { BrandMark } from "../components/ui/BrandMark";
import { CoachEntryLink } from "../components/auth/CoachEntryLink";

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
  const [consentAccepted, setConsentAccepted] = useState(false);
  const haptics = useHaptics();
  const shake = useRef(new Animated.Value(0)).current;
  const emailRef = useRef<TextInput>(null);
  const pwdRef = useRef<TextInput>(null);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailTrimmed = email.trim();
  const emailLooksValid = emailRegex.test(emailTrimmed);
  const canSubmit = emailLooksValid && pwd.length >= 6 && consentAccepted;

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
    if (!consentAccepted) {
      fail("Consentement requis", "Accepte la politique de confidentialité pour continuer.");
      return;
    }
    setLoading(true);
    let accountCreated = false;
    try {
      const cleanName = name.trim();
      const cred = await createUserWithEmailAndPassword(auth, emailTrimmed, pwd);
      accountCreated = true;
      trackEvent("register_success");
      // Départ du chrono funnel (Register → 1ère séance générée), consommé par
      // first_session_generated dans NewSessionScreen — aucune donnée perso.
      await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_START_TS, String(Date.now()));
      if (cleanName) {
        await updateProfile(cred.user, { displayName: cleanName });
      }
      await setDoc(
        doc(db, "users", cred.user.uid),
        {
          email: cred.user.email ?? emailTrimmed,
          // Prénom absent = null, JAMAIS la partie locale de l'email (règle 12).
          // L'ancien repli écrivait « kyky76700 » en base : re-préaffiché au
          // setup ET montré au coach dans son effectif (P1-04 inventaire
          // clubs). Le setup exige un prénom à l'étape 1 — c'est LÀ qu'il
          // arrive ; CoachPlayerRow sait afficher un état « sans prénom ».
          displayName: cleanName || null,
          firstName: cleanName || null,
          profileCompleted: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      // Pas de signOut : l'utilisateur reste connecté, le RootNavigator bascule
      // automatiquement vers le setup profil (profileCompleted: false). Zéro re-login.
      haptics.success();
      showToast({ type: "success", title: "Compte créé", message: "On configure ton profil." });
    } catch (e: any) {
      if (__DEV__) console.warn("[register]", e?.code ?? e);
      if (accountCreated) {
        // Le compte EST créé (seul updateProfile/setDoc a échoué) : le RootNavigator
        // bascule déjà vers le setup profil — ne pas afficher un faux échec.
        showToast({
          type: "warn",
          title: "Compte créé",
          message: "Petit souci réseau — complète ton profil pour finaliser.",
        });
        return;
      }
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
    <Screen keyboardAvoiding style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {/* Gabarit d'en-tête identique à Login (DA Polish) : zone de hauteur
              fixe même quand canGoBack() est faux (arrivée par navigation.reset
              depuis Welcome) — avant, la flèche ET son espace disparaissaient,
              ce qui décalait titre/CTA par rapport à Login. */}
          <View style={styles.headerRow}>
            {navigation.canGoBack() ? (
              <Pressable
                onPress={() => navigation.goBack()}
                style={({ pressed }) => [styles.back, pressed && styles.iconPressed]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chevron-back" size={20} color={palette.sub} />
              </Pressable>
            ) : null}
          </View>

          <BrandMark size="sm" style={styles.brandMark} />
          <Text style={styles.title}>Crée ton compte</Text>
          <Text style={styles.subtitle}>Rejoins ton club ou configure ton profil FKS.</Text>

          <Animated.View style={[styles.form, { transform: [{ translateX: shake }] }]}>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={16} color={palette.muted} style={styles.icon} />
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
              <Ionicons name="mail-outline" size={16} color={palette.muted} style={styles.icon} />
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
              <Ionicons name="lock-closed-outline" size={16} color={palette.muted} style={styles.icon} />
              <TextInput
                ref={pwdRef}
                placeholder="Mot de passe"
                placeholderTextColor={palette.muted}
                secureTextEntry={!showPwd}
                autoComplete="new-password"
                value={pwd}
                onChangeText={setPwd}
                returnKeyType="go"
                onSubmitEditing={() => {
                  if (!loading && canSubmit) void onRegister();
                }}
                style={styles.input}
              />
              <Pressable
                onPress={() => setShowPwd(!showPwd)}
                style={({ pressed }) => [styles.eye, pressed && styles.iconPressed]}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
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

            {/* Consentement RGPD explicite (données santé collectées ensuite) */}
            <View style={styles.consentRow}>
              <Pressable
                onPress={() => setConsentAccepted(!consentAccepted)}
                style={({ pressed }) => [styles.consentCheckbox, pressed && styles.iconPressed]}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consentAccepted }}
              >
                <Ionicons
                  name={consentAccepted ? "checkbox" : "square-outline"}
                  size={20}
                  color={consentAccepted ? palette.accent : palette.muted}
                />
              </Pressable>
              <Text style={styles.consentText}>
                J'accepte la{" "}
                <Text style={styles.consentLink} onPress={() => navigation.navigate("PrivacyPolicy")}>
                  politique de confidentialité
                </Text>{" "}
                et les{" "}
                <Text style={styles.consentLink} onPress={() => navigation.navigate("LegalNotice")}>
                  mentions légales
                </Text>
                .
              </Text>
            </View>

            <Button
              label={loading ? "" : "Suivant"}
              onPress={onRegister}
              disabled={loading || !canSubmit}
              variant="primary"
              size="lg"
              fullWidth
              style={[styles.ctaShadowOff, styles.ctaSpacing]}
              leftAccessory={loading ? <ActivityIndicator size="small" color="#fff" /> : undefined}
              accessibilityLabel="Créer mon compte"
            />
          </Animated.View>

          {/* Entrée coach — voir components/auth/CoachEntryLink : elle pose une
              INTENTION persistée (écran d'arrivée après l'inscription), jamais
              un droit. L'accueil qui la portait seul devient inatteignable dès
              le deuxième lancement (audit inscription 2026-09, erratum 1). */}
          <CoachEntryLink testID="coach-entry-register" />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Déjà un compte ?</Text>
            <Pressable
              onPress={() => navigation.navigate("Login")}
              style={({ pressed }) => pressed && styles.linkPressed}
              hitSlop={{ top: 14, bottom: 14, left: 10, right: 10 }}
            >
              <Text style={styles.footerLink}>Connecte-toi</Text>
            </Pressable>
          </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: palette.bg },
  scroll: { flexGrow: 1, paddingHorizontal: theme.spacing.xl2, justifyContent: "center", gap: 8 },
  // Zone de hauteur fixe (DA Polish) : identique que la flèche retour soit
  // affichée ou non, pour que titre/CTA ne sautent plus en Y entre Register
  // et Login selon canGoBack().
  headerRow: { height: 40, justifyContent: "center" },
  back: { alignSelf: "flex-start", padding: 8 },
  // Retour visuel au press (cibles tactiles auditées 2026-07) : les Pressable
  // ci-dessus n'avaient aucun feedback pendant l'appui (le seul changement
  // visible arrivait après relâchement, via le state) — cf. audit tactile.
  // DA Polish : opacité de press unifiée à 0.7 (lot0 §1.3, supprime 0.5/0.6).
  iconPressed: { opacity: 0.7 },
  linkPressed: { opacity: 0.7 },
  brandMark: { marginBottom: theme.spacing.lg },
  title: { ...theme.typography.title, color: palette.text, textAlign: "center" },
  subtitle: { ...theme.typography.body, color: palette.sub, textAlign: "center", marginBottom: theme.spacing.xl },
  form: { gap: theme.spacing.md },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.cardSoft,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, color: palette.text, fontSize: 15 },
  eye: { padding: 4 },
  error: { ...theme.typography.caption, color: palette.danger, marginLeft: 4 },
  strengthRow: { flexDirection: "row", alignItems: "center", gap: 10, marginLeft: 4 },
  strengthBars: { flexDirection: "row", gap: 4 },
  strengthBar: { width: 32, height: 4, borderRadius: theme.radius.pill },
  strengthLabel: { fontSize: 12, fontWeight: "600" },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 4, marginLeft: 4 },
  // marginTop: 1 (audit tactile/visuel) : la case (20px) dépassait d'~4px au-
  // dessus de la première ligne du texte (lineHeight 16) — réalignée.
  consentCheckbox: { marginTop: 1 },
  consentText: { flex: 1, color: palette.sub, ...theme.typography.caption },
  consentLink: { color: palette.accent, fontWeight: "700", textDecorationLine: "underline" },
  // Neutralise le halo orange de Button.primary (theme.shadow.accent porte
  // l'orange du dark, `#ff7a1a` — DA Polish lot0 §1.4). Local à cet écran :
  // Button.tsx garde son ombre par défaut pour ses 17 autres appelants.
  ctaShadowOff: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  ctaSpacing: { marginTop: 8 },
  footer: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: theme.spacing.xxl, paddingVertical: theme.spacing.lg },
  footerText: { ...theme.typography.body, color: palette.sub },
  footerLink: { color: palette.accent, fontSize: 15, fontWeight: "700" },
});
