// components/OfflineBanner.tsx
// Bandeau global "Hors-ligne" avec animation slide-in/out via NetInfo

import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { theme } from "../constants/theme";
import { zIndex as Z } from "../theme/zIndex";

const palette = theme.colors;
// Hauteur de la ligne de contenu (icone + texte), hors safe area.
const CONTENT_H = 36;

export function OfflineBanner() {
  // Depuis Lot 2, le SafeAreaProvider est a la racine (App.tsx) : le bandeau,
  // meme monte hors des navigators, lit desormais l'inset reel du haut au lieu
  // d'un 50 en dur (faux sur Dynamic Island = 59 et sur SE = 20).
  const insets = useSafeAreaInsets();
  const bannerH = insets.top + CONTENT_H;

  const [isOffline, setIsOffline] = useState(false);
  const translateY = useRef(new Animated.Value(-bannerH)).current;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsubscribe();
  }, []);

  const reduceMotionRef = useRef(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { reduceMotionRef.current = v; });
  }, []);

  useEffect(() => {
    const target = isOffline ? 0 : -bannerH;
    if (reduceMotionRef.current) {
      translateY.setValue(target);
    } else {
      Animated.timing(translateY, {
        toValue: target,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isOffline, translateY, bannerH]);

  return (
    <Animated.View
      style={[styles.banner, { transform: [{ translateY }] }]}
      pointerEvents={isOffline ? "auto" : "none"}
    >
      <View style={[styles.content, { paddingTop: insets.top }]}>
        <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
        <Text style={styles.text}>
          Hors-ligne — synchronisation au retour
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: Z.offlineBanner,
    backgroundColor: palette.warn,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
});
