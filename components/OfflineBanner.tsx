// components/OfflineBanner.tsx
// Bandeau global "Hors-ligne" avec animation slide-in/out via NetInfo

import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform, StatusBar, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { theme, TYPE } from "../constants/theme";
import { zIndex as Z } from "../theme/zIndex";

const palette = theme.colors;

const INSET_TOP = Platform.OS === "ios" ? 50 : (StatusBar.currentHeight ?? 24);
const BANNER_H = INSET_TOP + 36;

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const translateY = useRef(new Animated.Value(-BANNER_H)).current;

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
    const target = isOffline ? 0 : -BANNER_H;
    if (reduceMotionRef.current) {
      translateY.setValue(target);
    } else {
      Animated.timing(translateY, {
        toValue: target,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isOffline, translateY]);

  return (
    <Animated.View
      style={[styles.banner, { transform: [{ translateY }] }]}
      pointerEvents={isOffline ? "auto" : "none"}
    >
      <View style={[styles.content, { paddingTop: INSET_TOP }]}>
        <Ionicons name="cloud-offline-outline" size={16} color={theme.colors.white} />
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
    fontSize: TYPE.caption.fontSize,
    fontWeight: "700",
    color: theme.colors.white,
  },
});
