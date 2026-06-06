import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { theme, categoryColor } from "@/src/lib/theme";
import { api, Habit, todayString } from "@/src/lib/api";
import { Checkbox } from "@/src/components/Checkbox";
import { DateStrip } from "@/src/components/DateStrip";
import { Toast } from "@/src/components/Toast";

const MOOD_EMOJI = ["😞", "😕", "😐", "🙂", "😄"];

export default function CheckIn() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [notes, setNotes] = useState<string>("");
  const [showNotes, setShowNotes] = useState(false);
  const [habitStreaks, setHabitStreaks] = useState<Record<string, number>>({});

  const [date, setDate] = useState<string>(todayString());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [hs, ci, dash] = await Promise.all([
        api.listHabits(),
        api.getCheckin(date),
        api.dashboard().catch(() => null),
      ]);
      setHabits(hs);
      setHabitStreaks(dash?.habit_streaks ?? {});
      const ids = new Set(ci?.completed_habit_ids ?? []);
      setCompleted(ids);
      setMood(ci?.mood ?? null);
      setEnergy(ci?.energy ?? null);
      setNotes(ci?.notes ?? "");
      setShowNotes(!!(ci?.notes && ci.notes.length > 0));
      setSavedAt((ci as any)?.exists === false ? null : (ci as any)?.timestamp ?? null);
      setDirty(false);
    } catch (e) {
      console.warn("checkin load failed", e);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const grouped = useMemo(() => {
    const map: Record<string, Habit[]> = {};
    habits.forEach((h) => {
      if (!h.archived) (map[h.category] = map[h.category] ?? []).push(h);
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
        date,
        completed_habit_ids: Array.from(completed),
        mood: mood ?? null,
        energy: energy ?? null,
        notes: notes.trim() ? notes.trim() : null,
      });
      setSavedAt(new Date().toISOString());
      setDirty(false);
      setToastVisible(true);
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
  const isToday = date === todayString();
  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="check-in-screen">
      <Toast visible={toastVisible} message="Saved · analytics updated" onHide={() => setToastVisible(false)} />

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{isToday ? "Today" : "Backfill"}</Text>
          <Text style={styles.subtitle}>{dateLabel}</Text>
        </View>
        <View style={styles.progressPill}>
          <Text style={styles.progressText}>{totalDone}/{totalAll}</Text>
        </View>
      </View>

      <DateStrip selected={date} onChange={(d) => setDate(d)} />

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
              const streak = habitStreaks[h.id] ?? 0;
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
                  {streak > 0 && isToday && (
                    <View style={styles.streakPill}>
                      <Ionicons name="flame" size={11} color="#F59E0B" />
                      <Text style={styles.streakText}>{streak}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Mood */}
        <Text style={styles.metaLabel}>HOW DID THE DAY FEEL?</Text>
        <View style={styles.moodRow}>
          {MOOD_EMOJI.map((emo, i) => {
            const val = i + 1;
            const sel = mood === val;
            return (
              <TouchableOpacity
                key={i}
                onPress={() => {
                  setMood(sel ? null : val);
                  setDirty(true);
                }}
                style={[styles.moodBtn, sel && styles.moodBtnSel]}
                testID={`mood-${val}`}
              >
                <Text style={styles.moodEmoji}>{emo}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Energy */}
        <Text style={styles.metaLabel}>ENERGY LEVEL</Text>
        <View style={styles.energyRow}>
          {[1, 2, 3, 4, 5].map((v) => {
            const sel = energy !== null && energy >= v;
            return (
              <TouchableOpacity
                key={v}
                onPress={() => {
                  setEnergy(energy === v ? null : v);
                  setDirty(true);
                }}
                style={[styles.energyBar, sel && styles.energyBarSel]}
                testID={`energy-${v}`}
              />
            );
          })}
          <Text style={styles.energyLabel}>{energy ? `${energy}/5` : "—"}</Text>
        </View>

        {/* Notes */}
        <TouchableOpacity style={styles.notesToggle} onPress={() => setShowNotes((s) => !s)} testID="toggle-notes">
          <Ionicons
            name={showNotes ? "remove-circle-outline" : "add-circle-outline"}
            size={18}
            color={theme.colors.textSecondary}
          />
          <Text style={styles.notesToggleText}>{showNotes ? "Hide notes" : "Add a note"}</Text>
        </TouchableOpacity>
        {showNotes && (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <TextInput
              value={notes}
              onChangeText={(t) => {
                setNotes(t);
                setDirty(true);
              }}
              placeholder="What stood out today?"
              placeholderTextColor={theme.colors.textMuted}
              multiline
              style={styles.notesInput}
              testID="notes-input"
            />
          </KeyboardAvoidingView>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        {savedAt && !dirty && (
          <Text style={styles.savedText}>Saved · analytics auto-update</Text>
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
    paddingBottom: 8,
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
    marginTop: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: 3, backgroundColor: theme.colors.textPrimary },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  group: { marginBottom: 24 },
  groupHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  catDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  groupLabel: { color: theme.colors.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  itemText: { color: theme.colors.textPrimary, fontSize: 16, marginLeft: 14, fontWeight: "500", flex: 1 },
  itemTextDone: { color: theme.colors.textSecondary, textDecorationLine: "line-through" },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 3,
  },
  streakText: { color: theme.colors.textSecondary, fontSize: 11, fontWeight: "700" },

  metaLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: 16,
    marginBottom: 10,
  },
  moodRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  moodBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  moodBtnSel: { borderColor: theme.colors.textPrimary, backgroundColor: theme.colors.surfaceElevated },
  moodEmoji: { fontSize: 24 },

  energyRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  energyBar: {
    flex: 1,
    height: 10,
    borderRadius: 4,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  energyBarSel: { backgroundColor: theme.colors.textPrimary, borderColor: theme.colors.textPrimary },
  energyLabel: { color: theme.colors.textSecondary, fontSize: 12, marginLeft: 8, width: 28 },

  notesToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    marginTop: 8,
  },
  notesToggleText: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: "600" },
  notesInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    color: theme.colors.textPrimary,
    minHeight: 80,
    fontSize: 14,
    textAlignVertical: "top",
  },

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
