import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, Text, View, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { onToast, type ToastPayload } from "../../utils/toast";
import { theme } from "../../constants/theme";
import { zIndex as Z } from "../../theme/zIndex";

// Safe area top padding - accounts for notch on iOS devices
const NOTCH_SAFE_TOP = Platform.OS === "ios" ? 54 : 24;

const palette = theme.colors;

const toneMap = {
  success: { icon: "checkmark-circle", color: palette.success },
  error: { icon: "close-circle", color: palette.danger },
  warn: { icon: "alert-circle", color: palette.warn },
  info: { icon: "information-circle", color: palette.accent },
};

export function ToastHost() {
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const reduceMotionRef = useRef(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { reduceMotionRef.current = v; });
  }, []);

  useEffect(() => {
    return onToast((payload) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setToast(payload);
      if (reduceMotionRef.current) {
        anim.setValue(1);
      } else {
        Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      }
      const duration = payload.durationMs ?? 2200;
      timerRef.current = setTimeout(() => {
        if (reduceMotionRef.current) {
          anim.setValue(0);
          setToast(null);
        } else {
          Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
            setToast(null);
          });
        }
      }, duration);
    });
  }, [anim]);

  if (!toast) return null;
  const tone = toast.type ?? "info";
  const toneConfig = toneMap[tone];

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-20, 0],
              }),
            },
          ],
        },
      ]}
      pointerEvents="none"
    >
      <View style={styles.card}>
        <Ionicons name={toneConfig.icon as any} size={18} color={toneConfig.color} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{toast.title}</Text>
          {toast.message ? <Text style={styles.message}>{toast.message}</Text> : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: NOTCH_SAFE_TOP,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: Z.toast,
  },
  card: {
    minWidth: "86%",
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.text,
  },
  message: {
    marginTop: 2,
    fontSize: 11,
    color: palette.sub,
  },
});
