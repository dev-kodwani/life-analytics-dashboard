import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { theme } from "@/src/lib/theme";

type Props = {
  score: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
};

export const LifeScoreRing: React.FC<Props> = ({
  score,
  size = 200,
  strokeWidth = 14,
  label = "LIFE SCORE",
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const offset = circumference * (1 - pct);
  const display = Math.round(score);

  return (
    <View style={[styles.wrap, { width: size, height: size }]} testID="life-score-ring">
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.accent}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={styles.score} testID="life-score-value">{display}</Text>
        <Text style={styles.total}>/ 100</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  center: { position: "absolute", alignItems: "center", justifyContent: "center" },
  score: {
    fontSize: 56,
    fontWeight: "800",
    color: theme.colors.textPrimary,
    letterSpacing: -2,
    lineHeight: 60,
  },
  total: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 2 },
  label: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    letterSpacing: 2,
    marginTop: 6,
    fontWeight: "600",
  },
});
