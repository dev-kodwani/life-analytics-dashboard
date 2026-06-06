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
import { Ionicons } from "@expo/vector-icons";

import { theme, categoryColor } from "@/src/lib/theme";
import { api, InsightsData } from "@/src/lib/api";
import { TrendChart } from "@/src/components/TrendChart";

export default function Insights() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.insights();
      setData(d);
    } catch (e) {
      console.warn("insights load failed", e);
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.textPrimary} />
        </View>
      </SafeAreaView>
    );
  }

  const values = (data?.weekly_trend ?? []).map((w) => w.score);
  const labels = (data?.weekly_trend ?? []).map((w, i) => (i % 3 === 0 ? w.week.slice(5) : ""));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="insights-screen">
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
        <Text style={styles.title}>Insights</Text>
        <Text style={styles.subtitle}>Trends, patterns, and predictions</Text>

        {data?.narratives && data.narratives.length > 0 && (
          <View style={styles.narrativeBlock}>
            {data.narratives.map((n, i) => (
              <View key={i} style={styles.narrativeRow}>
                <Ionicons name="sparkles-outline" size={16} color={theme.colors.textPrimary} />
                <Text style={styles.narrativeText}>{n}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionLabel}>WEEKLY TREND · 12 WEEKS</Text>
        <View style={styles.card}>
          <TrendChart values={values} labels={labels} />
          {data?.prediction && (
            <View style={styles.predictionRow}>
              <Ionicons name="trending-up" size={16} color={theme.colors.textSecondary} />
              <Text style={styles.predictionText}>
                Next week forecast: <Text style={styles.predictionValue}>{data.prediction.next_week_score}%</Text>
                {"  "}({data.prediction.slope_per_week >= 0 ? "+" : ""}
                {data.prediction.slope_per_week}/wk)
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionLabel}>TOP HABITS · LAST 30 DAYS</Text>
        <View style={styles.card}>
          {(data?.habit_frequency ?? []).slice(0, 6).map((h) => (
            <View key={h.habit_id} style={styles.freqRow}>
              <View style={[styles.freqDot, { backgroundColor: categoryColor(h.category) }]} />
              <Text style={styles.freqName}>{h.name}</Text>
              <View style={styles.freqBarTrack}>
                <View
                  style={{
                    height: 4,
                    width: `${h.percent}%`,
                    backgroundColor: categoryColor(h.category),
                    borderRadius: 2,
                  }}
                />
              </View>
              <Text style={styles.freqPct}>{h.percent}%</Text>
            </View>
          ))}
          {(data?.habit_frequency ?? []).length === 0 && (
            <Text style={styles.empty}>Track a few days to see your top habits.</Text>
          )}
        </View>

        <Text style={styles.sectionLabel}>CORRELATIONS</Text>
        <View style={styles.card}>
          {(data?.correlations ?? []).length === 0 ? (
            <Text style={styles.empty}>
              Need at least 5 check-ins to surface correlations.
            </Text>
          ) : (
            (data?.correlations ?? []).map((c, i) => (
              <View key={i} style={styles.corrRow}>
                <View style={styles.corrLeft}>
                  <Text style={styles.corrPair} numberOfLines={1}>
                    {c.habit_a} <Text style={styles.corrAmp}>+</Text> {c.habit_b}
                  </Text>
                  <Text style={styles.corrSub}>
                    {c.correlation > 0 ? "Rise together" : "Trade off"}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.corrValue,
                    { color: c.correlation > 0 ? theme.colors.success : theme.colors.danger },
                  ]}
                >
                  {c.correlation > 0 ? "+" : ""}
                  {c.correlation}
                </Text>
              </View>
            ))
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  title: { color: theme.colors.textPrimary, fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { color: theme.colors.textSecondary, fontSize: 14, marginTop: 4, marginBottom: 20 },
  sectionLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.5,
    marginBottom: 12,
    marginTop: 8,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginBottom: 20,
  },
  narrativeBlock: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  narrativeRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  narrativeText: { color: theme.colors.textPrimary, fontSize: 14, lineHeight: 20, flex: 1 },
  predictionRow: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 6 },
  predictionText: { color: theme.colors.textSecondary, fontSize: 13 },
  predictionValue: { color: theme.colors.textPrimary, fontWeight: "700" },
  freqRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  freqDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  freqName: { color: theme.colors.textPrimary, fontSize: 14, width: 110 },
  freqBarTrack: { flex: 1, height: 4, backgroundColor: theme.colors.border, borderRadius: 2, marginRight: 10 },
  freqPct: { color: theme.colors.textSecondary, fontSize: 12, width: 40, textAlign: "right" },
  corrRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  corrLeft: { flex: 1, paddingRight: 12 },
  corrPair: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: "500" },
  corrAmp: { color: theme.colors.textSecondary },
  corrSub: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  corrValue: { fontSize: 18, fontWeight: "700" },
  empty: { color: theme.colors.textSecondary, fontSize: 14, paddingVertical: 12 },
});
