import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Polyline, Line, Circle } from "react-native-svg";
import { theme } from "@/src/lib/theme";

type Props = {
  values: number[]; // 0-100
  labels?: string[];
  height?: number;
};

export const TrendChart: React.FC<Props> = ({ values, labels, height = 140 }) => {
  const width = 320;
  const padX = 20;
  const padY = 16;
  const w = width - padX * 2;
  const h = height - padY * 2;
  const max = 100;
  const n = values.length;
  if (n === 0) return <Text style={styles.empty}>No data yet</Text>;

  const points = values.map((v, i) => {
    const x = padX + (n === 1 ? w / 2 : (w * i) / (n - 1));
    const y = padY + h - (Math.max(0, Math.min(max, v)) / max) * h;
    return { x, y };
  });
  const pointsStr = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <View testID="trend-chart">
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
          <Line
            key={i}
            x1={padX}
            x2={width - padX}
            y1={padY + h * p}
            y2={padY + h * p}
            stroke={theme.colors.border}
            strokeWidth={1}
          />
        ))}
        <Polyline
          points={pointsStr}
          fill="none"
          stroke={theme.colors.textPrimary}
          strokeWidth={2}
        />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3} fill={theme.colors.textPrimary} />
        ))}
      </Svg>
      {labels && (
        <View style={styles.labels}>
          {labels.map((l, i) => (
            <Text key={i} style={styles.label}>
              {l}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  empty: { color: theme.colors.textSecondary, padding: 16 },
  labels: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, marginTop: 4 },
  label: { fontSize: 10, color: theme.colors.textSecondary },
});
