import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import { theme, categoryColor } from "@/src/lib/theme";
import { api, Habit, todayString } from "@/src/lib/api";
import { Checkbox } from "@/src/components/Checkbox";

export default function CheckIn() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const today = todayString();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [hs, ci] = await Promise.all([api.listHabits(), api.getCheckin(today)]);
      setHabits(hs);
      const ids = new Set(ci?.completed_habit_ids ?? []);
      setCompleted(ids);
      if ((ci as any).exists === false) {
        setSavedAt(null);
      } else {
        setSavedAt((ci as any).timestamp ?? null);
      }
      setDirty(false);
    } catch (e) {
      console.warn("checkin load failed", e);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const grouped = useMemo(() => {
    const map: Record<string, Habit[]> = {};
    habits.forEach((h) => {
      if (!h.archived) {
        (map[h.category] = map[h.category] ?? []).push(h);
      }
    });
    return map;
  }, [habits]);

  const toggle = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setDirty(true);
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await api.upsertCheckin({
        date: today,
        completed_habit_ids: Array.from(completed),
      });
      setSavedAt(new Date().toISOString());
      setDirty(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      console.warn("save failed", e);
    } finally {
      setSaving(false);
    }
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

  const totalDone = completed.size;
  const totalAll = habits.filter((h) => !h.archived).length;
  const pct = totalAll ? Math.round((totalDone / totalAll) * 100) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="check-in-screen">
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Daily Check-In</Text>
          <Text style={styles.subtitle}>
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </Text>
        </View>
        <View style={styles.progressPill}>
          <Text style={styles.progressText}>{totalDone}/{totalAll}</Text>
        </View>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {Object.keys(grouped).map((cat) => (
          <View key={cat} style={styles.group}>
            <View style={styles.groupHeader}>
              <View style={[styles.catDot, { backgroundColor: categoryColor(cat) }]} />
              <Text style={styles.groupLabel}>{cat.toUpperCase()}</Text>
            </View>
            {grouped[cat].map((h) => {
              const done = completed.has(h.id);
              return (
                <TouchableOpacity
                  key={h.id}
                  style={styles.item}
                  onPress={() => toggle(h.id)}
                  activeOpacity={0.7}
                  testID={`habit-${h.id}`}
                >
                  <Checkbox checked={done} color={categoryColor(cat)} />
                  <Text style={[styles.itemText, done && styles.itemTextDone]}>{h.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        {savedAt && !dirty && (
          <Text style={styles.savedText}>Saved · changes auto-update analytics</Text>
        )}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.5 }]}
          onPress={onSave}
          disabled={saving}
          testID="save-day-button"
        >
          {saving ? (
            <ActivityIndicator color={theme.colors.bg} />
          ) : (
            <Text style={styles.saveBtnText}>{savedAt ? "Update Day" : "Save Day"}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { color: theme.colors.textPrimary, fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { color: theme.colors.textSecondary, fontSize: 14, marginTop: 2 },
  progressPill: {
    backgroundColor: theme.colors.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  progressText: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: "600" },
  progressBar: {
    height: 3,
    backgroundColor: theme.colors.surface,
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: 3, backgroundColor: theme.colors.textPrimary },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  group: { marginBottom: 24 },
  groupHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  catDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  groupLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  itemText: { color: theme.colors.textPrimary, fontSize: 16, marginLeft: 14, fontWeight: "500" },
  itemTextDone: { color: theme.colors.textSecondary, textDecorationLine: "line-through" },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: theme.colors.bg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  savedText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    textAlign: "center",
    marginBottom: 8,
  },
  saveBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveBtnText: { color: theme.colors.bg, fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },
});
