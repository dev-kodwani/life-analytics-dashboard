import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { theme } from "@/src/lib/theme";

type Cell = { date: string; level: number; score: number };

type Props = {
  data: Cell[]; // earliest -> latest
};

const CELL = 12;
const GAP = 3;
const WEEKS = 26; // ~6 months

export const Heatmap: React.FC<Props> = ({ data }) => {
  // Build a 7 (rows = day-of-week) x WEEKS grid. Latest column = most recent week.
  // We align so the last cell is the last item in data (today).
  const today = data.length ? new Date(data[data.length - 1].date) : new Date();
  const todayDow = today.getDay(); // 0..6 (Sun..Sat)
  const totalCells = WEEKS * 7;
  // The bottom-right block index (col=WEEKS-1, row=todayDow) corresponds to today.
  // Compute date for each cell (col-major).
  const lastIndexInGrid = (WEEKS - 1) * 7 + todayDow;
  const grid: (Cell | null)[] = new Array(totalCells).fill(null);
  // map for fast lookup
  const map = new Map<string, Cell>();
  data.forEach((c) => map.set(c.date, c));

  for (let i = 0; i < totalCells; i++) {
    const daysBack = lastIndexInGrid - i;
    const d = new Date(today);
    d.setDate(today.getDate() - daysBack);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    grid[i] = map.get(ds) ?? { date: ds, level: 0, score: 0 };
  }

  // Render columns (weeks)
  const columns: (Cell | null)[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const col: (Cell | null)[] = [];
    for (let r = 0; r < 7; r++) col.push(grid[w * 7 + r]);
    columns.push(col);
  }

  return (
    <View testID="heatmap" style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {columns.map((col, ci) => (
          <View key={ci} style={{ marginRight: GAP }}>
            {col.map((cell, ri) => (
              <View
                key={ri}
                style={[
                  styles.cell,
                  {
                    backgroundColor:
                      theme.colors.heatmap[cell ? cell.level : 0] ??
                      theme.colors.heatmap[0],
                    marginBottom: ri === 6 ? 0 : GAP,
                  },
                ]}
              />
            ))}
          </View>
        ))}
      </ScrollView>
      <View style={styles.legend}>
        <Text style={styles.legendText}>Less</Text>
        {theme.colors.heatmap.map((c, i) => (
          <View key={i} style={[styles.cell, { backgroundColor: c, marginHorizontal: 2 }]} />
        ))}
        <Text style={styles.legendText}>More</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingVertical: 8 },
  row: { paddingHorizontal: 2 },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 3,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 12,
    paddingHorizontal: 4,
  },
  legendText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginHorizontal: 6,
  },
});
