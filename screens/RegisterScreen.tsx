// screens/RegisterScreen.tsx
// Inscription — Nike TC × Strava design

import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
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
  StatusBar,
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
import { runShake } from "../utils/animations";
import { ds, typo, space, radius, anim } from "../theme/authDesignSystem";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

const getRegisterErrorMessage = (code?: string) => {
  switch (code) {
    case "auth/invalid-email":
      return "Email invalide.";
    case "auth/email-already-in-use":
      return "Cet email est d\u00e9j\u00e0 utilis\u00e9.";
    case "auth/weak-password":
      return "Mot de passe trop faible (minimum 6 caract\u00e8res).";
    case "auth/network-request-failed":
      return "Probl\u00e8me r\u00e9seau. V\u00e9rifie ta connexion.";
    case "auth/too-many-requests":
      return "Trop de tentatives. R\u00e9essaie dans quelques minutes.";
    default:
      return "V\u00e9rifie tes infos et r\u00e9essaie.";
  }
};

const NAME_REGEX = /^[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF\-' ]{2,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen({ navigation }: Props) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const haptics = useHaptics();
  const shake = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const emailRef = useRef<TextInput>(null);
  const pwdRef = useRef<TextInput>(null);

  const nameTrimmed = displayName.trim();
  const emailTrimmed = email.trim();
  const nameValid = NAME_REGEX.test(nameTrimmed);
  const emailValid = EMAIL_REGEX.test(emailTrimmed);
  const pwdValid = pwd.length >= 6;
  const canSubmit = nameValid && emailValid && pwdValid;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) {
        fadeIn.setValue(1);
      } else {
        Animated.timing(fadeIn, {
          toValue: 1,
          duration: anim.slow,
          useNativeDriver: true,
        }).start();
      }
    });
  }, [fadeIn]);

  const safeShake = () => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!reduced) runShake(shake);
    });
  };

  const fail = (title: string, message?: string) => {
    safeShake();
    haptics.warning();
    showToast({ type: "error", title, message });
  };

  const onRegister = async () => {
    if (!nameTrimmed) {
      fail("Pr\u00e9nom requis", "Entre ton pr\u00e9nom pour continuer.");
      return;
    }
    if (!nameValid) {
      fail("Pr\u00e9nom invalide", "2 caract\u00e8res minimum, pas de caract\u00e8res sp\u00e9ciaux.");
      return;
    }
    if (!emailValid) {
      fail("Email invalide", "Entre une adresse email valide.");
      return;
    }
    if (!pwdValid) {
      fail("Mot de passe trop court", "Minimum 6 caract\u00e8res.");
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, emailTrimmed, pwd);
      await updateProfile(cred.user, { displayName: nameTrimmed });
      await setDoc(
        doc(db, "users", cred.user.uid),
        {
          email: cred.user.email ?? emailTrimmed,
          displayName: nameTrimmed,
          firstName: nameTrimmed,
          profileCompleted: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      haptics.success();
      showToast({
        type: "success",
        title: "Bienvenue !",
        message: `Salut ${nameTrimmed}, ton compte est cr\u00e9\u00e9.`,
      });
    } catch (e: any) {
      showError(e, "Inscription");
      safeShake();
      haptics.error();
      showToast({
        type: "error",
        title: "Inscription \u00e9chou\u00e9e",
        message: getRegisterErrorMessage(e?.code),
      });
    } finally {
      setLoading(false);
    }
  };

  // Password strength
  const strength = pwd.length === 0 ? 0 : pwd.length < 6 ? 1 : pwd.length < 10 ? 2 : 3;
  const strengthColor = ["transparent", ds.error, "#FFB84D", ds.success];
  const strengthLabel = ["", "Faible", "Moyen", "Fort"];

  const showNameErr = displayName.length > 0 && !nameValid;
  const showEmailErr = email.length > 0 && !emailValid;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={ds.bg} />
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView
              contentContainerStyle={s.scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Back */}
              <Pressable
                onPress={() => navigation.goBack()}
                style={s.back}
                accessibilityLabel="Retour"
                accessibilityRole="button"
              >
                <Ionicons name="chevron-back" size={24} color={ds.textSecondary} />
              </Pressable>

              {/* Header */}
              <View style={s.header}>
                <Text style={s.title}>Cr\u00e9e ton compte</Text>
                <Text style={s.subtitle}>
                  En 30 secondes, c'est promis.
                </Text>
              </View>

              {/* Form */}
              <Animated.View
                style={[
                  s.form,
                  {
                    opacity: fadeIn,
                    transform: [{ translateX: shake }],
                  },
                ]}
              >
                {/* Pr\u00e9nom */}
                <View style={s.field}>
                  <Text style={s.label}>PR\u00c9NOM</Text>
                  <View style={s.inputWrap}>
                    <Ionicons name="person-outline" size={18} color={ds.textTertiary} style={s.inputIcon} />
                    <TextInput
                      placeholder="Ton pr\u00e9nom"
                      placeholderTextColor={ds.textTertiary}
                      value={displayName}
                      onChangeText={setDisplayName}
                      autoComplete="name"
                      autoCapitalize="words"
                      returnKeyType="next"
                      onSubmitEditing={() => emailRef.current?.focus()}
                      style={s.input}
                      accessibilityLabel="Champ pr\u00e9nom"
                    />
                  </View>
                  {showNameErr && (
                    <Text style={s.error}>2 caract\u00e8res minimum, lettres uniquement</Text>
                  )}
                </View>

                {/* Email */}
                <View style={s.field}>
                  <Text style={s.label}>EMAIL</Text>
                  <View style={s.inputWrap}>
                    <Ionicons name="mail-outline" size={18} color={ds.textTertiary} style={s.inputIcon} />
                    <TextInput
                      ref={emailRef}
                      placeholder="Ton email"
                      placeholderTextColor={ds.textTertiary}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoComplete="email"
                      value={email}
                      onChangeText={setEmail}
                      returnKeyType="next"
                      onSubmitEditing={() => pwdRef.current?.focus()}
                      style={s.input}
                      accessibilityLabel="Champ email"
                    />
                  </View>
                  {showEmailErr && (
                    <Text style={s.error}>Format email invalide</Text>
                  )}
                </View>

                {/* Mot de passe */}
                <View style={s.field}>
                  <Text style={s.label}>MOT DE PASSE</Text>
                  <View style={s.inputWrap}>
                    <Ionicons name="lock-closed-outline" size={18} color={ds.textTertiary} style={s.inputIcon} />
                    <TextInput
                      ref={pwdRef}
                      placeholder="Minimum 6 caract\u00e8res"
                      placeholderTextColor={ds.textTertiary}
                      secureTextEntry={!showPwd}
                      autoComplete="new-password"
                      value={pwd}
                      onChangeText={setPwd}
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        if (!loading && canSubmit) void onRegister();
                      }}
                      style={s.input}
                      accessibilityLabel="Champ mot de passe"
                    />
                    <Pressable
                      onPress={() => setShowPwd(!showPwd)}
                      style={s.eyeBtn}
                      accessibilityLabel={showPwd ? "Masquer" : "Afficher"}
                    >
                      <Ionicons
                        name={showPwd ? "eye-off-outline" : "eye-outline"}
                        size={20}
                        color={ds.textTertiary}
                      />
                    </Pressable>
                  </View>
                  {pwd.length > 0 && (
                    <View style={s.strengthRow}>
                      <View style={s.strengthBars}>
                        {[1, 2, 3].map((lvl) => (
                          <View
                            key={lvl}
                            style={[
                              s.strengthBar,
                              {
                                backgroundColor:
                                  strength >= lvl
                                    ? strengthColor[strength]
                                    : ds.border,
                              },
                            ]}
                          />
                        ))}
                      </View>
                      <Text style={[s.strengthText, { color: strengthColor[strength] }]}>
                        {strengthLabel[strength]}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Submit */}
                <View style={{ height: space.sm }} />
                <Pressable
                  onPress={onRegister}
                  disabled={loading || !canSubmit}
                  style={({ pressed }) => [
                    s.cta,
                    pressed && s.ctaPressed,
                    (loading || !canSubmit) && s.ctaDisabled,
                  ]}
                  accessibilityLabel="Suivant"
                  accessibilityRole="button"
                >
                  <LinearGradient
                    colors={loading || !canSubmit ? [...ds.gradientDisabled] : [...ds.gradientAccent]}
                    style={s.ctaInner}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <View style={s.loadingRow}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={s.ctaText}>Cr\u00e9ation...</Text>
                      </View>
                    ) : (
                      <>
                        <Text style={s.ctaText}>Suivant</Text>
                        <Ionicons name="arrow-forward" size={18} color={ds.textOnAccent} />
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
              </Animated.View>

              {/* Footer */}
              <View style={s.footer}>
                <Text style={s.footerText}>
                  D\u00e9j\u00e0 un compte ?{" "}
                  <Text
                    style={s.footerLink}
                    onPress={() => navigation.navigate("Login")}
                    accessibilityLabel="Se connecter"
                    accessibilityRole="button"
                  >
                    Se connecter
                  </Text>
                </Text>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ds.bg,
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: space.screenH,
    paddingBottom: space.xxl,
    justifyContent: "center",
    gap: space.sectionGap,
  },
  back: {
    alignSelf: "flex-start",
    padding: space.sm,
  },
  header: {
    gap: space.sm,
  },
  title: {
    color: ds.text,
    ...typo.title,
  },
  subtitle: {
    color: ds.textSecondary,
    ...typo.subtitle,
  },
  form: {
    gap: space.inputGap,
  },
  field: {
    gap: space.sm,
  },
  label: {
    color: ds.textSecondary,
    ...typo.sectionLabel,
    marginLeft: 4,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    backgroundColor: ds.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: ds.border,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: ds.text,
    ...typo.body,
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 4,
  },
  error: {
    color: ds.error,
    ...typo.caption,
    marginLeft: 4,
  },
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    marginLeft: 4,
  },
  strengthBars: {
    flexDirection: "row",
    gap: 4,
  },
  strengthBar: {
    width: 32,
    height: 3,
    borderRadius: 1.5,
  },
  strengthText: {
    ...typo.caption,
  },

  // CTA
  cta: {
    height: 56,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  ctaPressed: {
    opacity: anim.pressOpacity,
    transform: [{ scale: anim.pressScale }],
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 24,
  },
  ctaText: {
    color: ds.textOnAccent,
    ...typo.button,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  // Footer
  footer: {
    alignItems: "center",
    paddingVertical: space.lg,
  },
  footerText: {
    color: ds.textSecondary,
    ...typo.body,
  },
  footerLink: {
    color: ds.accent,
    fontWeight: "700",
  },
});
