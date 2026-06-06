import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/lib/theme";

type Props = {
  checked: boolean;
  color?: string;
  size?: number;
};

export const Checkbox: React.FC<Props> = ({ checked, color = theme.colors.accent, size = 26 }) => {
  return (
    <View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: checked ? color : theme.colors.borderStrong,
          backgroundColor: checked ? color : "transparent",
        },
      ]}
    >
      {checked && <Ionicons name="checkmark" size={size * 0.65} color={theme.colors.bg} />}
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
