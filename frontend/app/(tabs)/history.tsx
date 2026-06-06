import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";

import { theme, categoryColor } from "@/src/lib/theme";
import { api, CheckIn, Habit } from "@/src/lib/api";

export default function History() {
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cs, hs] = await Promise.all([api.listCheckins(), api.listHabits()]);
      setCheckins(cs);
      setHabits(hs);
    } catch (e) {
      console.warn("history load failed", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const habitsById: Record<string, Habit> = Object.fromEntries(habits.map((h) => [h.id, h]));
  const idsByCategory: Record<string, string[]> = {};
  habits.forEach((h) => {
    if (!h.archived) (idsByCategory[h.category] = idsByCategory[h.category] ?? []).push(h.id);
  });
  const categories = Object.keys(idsByCategory);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.textPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="history-screen">
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>{checkins.length} days tracked</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={theme.colors.textPrimary}
          />
        }
      >
        {checkins.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No check-ins yet. Save your first day on the Check-In tab.</Text>
          </View>
        )}
        {checkins.map((c) => {
          const completed = new Set(c.completed_habit_ids);
          const total = habits.filter((h) => !h.archived).length;
          const done = c.completed_habit_ids.filter((id) => habitsById[id] && !habitsById[id].archived).length;
          const pct = total ? Math.round((done / total) * 100) : 0;
          const d = new Date(c.date);
          const day = d.toLocaleDateString(undefined, { weekday: "short" });
          const dateLabel = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
          return (
            <View key={c.date} style={styles.row} testID={`history-row-${c.date}`}>
              <View style={styles.dateBlock}>
                <Text style={styles.day}>{day}</Text>
                <Text style={styles.date}>{dateLabel}</Text>
              </View>
              <View style={styles.middleBlock}>
                <View style={styles.dotsRow}>
                  {categories.map((cat) => {
                    const ids = idsByCategory[cat];
                    const catDone = ids.filter((id) => completed.has(id)).length;
                    const active = catDone > 0;
                    return (
                      <View
                        key={cat}
                        style={[
                          styles.catDot,
                          {
                            backgroundColor: active ? categoryColor(cat) : theme.colors.border,
                            opacity: active ? Math.max(0.4, catDone / ids.length) : 1,
                          },
                        ]}
                      />
                    );
                  })}
                </View>
                <Text style={styles.subText}>
                  {done}/{total} habits
                </Text>
              </View>
              <View style={styles.scoreBlock}>
                <Text style={styles.score}>{pct}%</Text>
              </View>
            </View>
          );
        })}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { color: theme.colors.textPrimary, fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { color: theme.colors.textSecondary, fontSize: 14, marginTop: 4 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  empty: { paddingVertical: 60, alignItems: "center" },
  emptyText: { color: theme.colors.textSecondary, fontSize: 14, textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dateBlock: { width: 60 },
  day: { color: theme.colors.textSecondary, fontSize: 11, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase" },
  date: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: "600", marginTop: 2 },
  middleBlock: { flex: 1, paddingHorizontal: 12 },
  dotsRow: { flexDirection: "row", gap: 6 },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  subText: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 6 },
  scoreBlock: { alignItems: "flex-end" },
  score: { color: theme.colors.textPrimary, fontSize: 18, fontWeight: "700", letterSpacing: -0.3 },
});
