import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { theme, categoryColor } from "@/src/lib/theme";
import { api, DashboardData } from "@/src/lib/api";
import { LifeScoreRing } from "@/src/components/LifeScoreRing";
import { Heatmap } from "@/src/components/Heatmap";

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.dashboard();
      setData(d);
    } catch (e) {
      console.warn("dashboard load failed", e);
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

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.textPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const cats = data ? Object.entries(data.category_scores) : [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="dashboard-screen">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.textPrimary} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting()}</Text>
          <Text style={styles.date}>{dateLabel}</Text>
        </View>

        <View style={styles.ringWrap}>
          <LifeScoreRing score={data?.life_score ?? 0} size={220} />
        </View>

        <View style={styles.row}>
          <StatCard
            icon="flame"
            label="Current Streak"
            value={`${data?.current_streak ?? 0}d`}
            testID="current-streak-card"
          />
          <StatCard
            icon="trophy"
            label="Best Streak"
            value={`${data?.best_streak ?? 0}d`}
            testID="best-streak-card"
          />
        </View>

        <Text style={styles.sectionLabel}>CATEGORY SCORES</Text>
        <View style={styles.catGrid}>
          {cats.map(([cat, score]) => (
            <View key={cat} style={styles.catCard} testID={`category-card-${cat.toLowerCase().replace(/\s+/g, "-")}`}>
              <View style={[styles.catDot, { backgroundColor: categoryColor(cat) }]} />
              <Text style={styles.catName}>{cat}</Text>
              <Text style={styles.catScore}>{Math.round(score)}%</Text>
              <View style={styles.catBar}>
                <View
                  style={{
                    height: 4,
                    width: `${Math.min(100, Math.max(0, score))}%`,
                    backgroundColor: categoryColor(cat),
                    borderRadius: 2,
                  }}
                />
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>ACTIVITY · LAST 6 MONTHS</Text>
        <View style={styles.heatmapWrap}>
          <Heatmap data={data?.heatmap ?? []} />
        </View>

        <Text style={styles.sectionLabel}>TODAY</Text>
        <View style={styles.todayCard}>
          <Text style={styles.todayScore}>{Math.round(data?.today_scores?.overall ?? 0)}%</Text>
          <Text style={styles.todaySub}>
            {data?.today_completed_ids.length ?? 0} of {data?.total_habits ?? 0} habits completed
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const StatCard: React.FC<{ icon: any; label: string; value: string; testID: string }> = ({
  icon,
  label,
  value,
  testID,
}) => (
  <View style={styles.statCard} testID={testID}>
    <Ionicons name={icon} size={18} color={theme.colors.textSecondary} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { paddingTop: 16, paddingBottom: 8 },
  greeting: { color: theme.colors.textPrimary, fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  date: { color: theme.colors.textSecondary, fontSize: 14, marginTop: 4 },
  ringWrap: { alignItems: "center", marginVertical: 24 },
  row: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  statValue: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    marginTop: 8,
    letterSpacing: -0.5,
  },
  statLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    marginTop: 2,
    textTransform: "uppercase",
  },
  sectionLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.5,
    marginBottom: 12,
    marginTop: 8,
  },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  catCard: {
    width: "48%",
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  catDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 12 },
  catName: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: "600" },
  catScore: { color: theme.colors.textPrimary, fontSize: 22, fontWeight: "700", marginTop: 4, letterSpacing: -0.5 },
  catBar: { height: 4, backgroundColor: theme.colors.border, borderRadius: 2, marginTop: 10, overflow: "hidden" },
  heatmapWrap: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginBottom: 24,
  },
  todayCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
  },
  todayScore: {
    color: theme.colors.textPrimary,
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1,
  },
  todaySub: { color: theme.colors.textSecondary, fontSize: 14, marginTop: 4 },
});
