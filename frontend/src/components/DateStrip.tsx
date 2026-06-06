import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { theme } from "@/src/lib/theme";
import { todayString } from "@/src/lib/api";

type Props = {
  selected: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  days?: number;
};

const fmt = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const DateStrip: React.FC<Props> = ({ selected, onChange, days = 14 }) => {
  const today = new Date();
  const today_s = todayString();
  const items: { date: string; day: string; num: string }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    items.push({
      date: fmt(d),
      day: d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3),
      num: String(d.getDate()),
    });
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      testID="date-strip"
    >
      {items.map((it) => {
        const isSel = it.date === selected;
        const isToday = it.date === today_s;
        return (
          <TouchableOpacity
            key={it.date}
            onPress={() => onChange(it.date)}
            style={[
              styles.item,
              isSel && styles.itemSelected,
              !isSel && isToday && styles.itemToday,
            ]}
            testID={`date-${it.date}`}
          >
            <Text style={[styles.day, isSel && styles.daySelected]}>{it.day.toUpperCase()}</Text>
            <Text style={[styles.num, isSel && styles.numSelected]}>{it.num}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: { paddingHorizontal: 20, gap: 8, paddingVertical: 8 },
  item: {
    width: 52,
    height: 64,
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  itemSelected: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  itemToday: {
    borderColor: theme.colors.textPrimary,
  },
  day: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  daySelected: { color: theme.colors.bg },
  num: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },
  numSelected: { color: theme.colors.bg },
});
