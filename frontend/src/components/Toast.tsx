import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/lib/theme";

type Props = {
  visible: boolean;
  message: string;
  onHide: () => void;
};

export const Toast: React.FC<Props> = ({ visible, message, onHide }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 7 }),
      ]).start();
      const t = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 20, duration: 200, useNativeDriver: true }),
        ]).start(() => onHide());
      }, 1800);
      return () => clearTimeout(t);
    }
  }, [visible, opacity, translateY, onHide]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={styles.wrap} testID="toast">
      <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]}>
        <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 64,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1000,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8,
  },
  text: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: "600" },
});
