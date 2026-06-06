import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { theme, categoryColor } from "@/src/lib/theme";
import { api, Habit } from "@/src/lib/api";

const DEFAULT_CATEGORIES = ["Health", "Learning", "Career", "Personal Growth", "Money"];

export default function Settings() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<string>(DEFAULT_CATEGORIES[0]);
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [customCat, setCustomCat] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const load = useCallback(async () => {
    try {
      const hs = await api.listHabits();
      setHabits(hs);
    } catch (e) {
      console.warn("settings load failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const categories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    habits.forEach((h) => set.add(h.category));
    return Array.from(set);
  }, [habits]);

  const grouped = useMemo(() => {
    const map: Record<string, Habit[]> = {};
    habits.forEach((h) => (map[h.category] = map[h.category] ?? []).push(h));
    return map;
  }, [habits]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const cat = customCat.trim() || newCategory;
      await api.createHabit({ name: newName.trim(), category: cat });
      setNewName("");
      setCustomCat("");
      setShowAdd(false);
      await load();
    } catch (e) {
      console.warn("add habit failed", e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await api.deleteHabit(id);
    load();
  };

  const handleRenameSave = async () => {
    if (!editingId) return;
    if (editingName.trim()) {
      await api.updateHabit(editingId, { name: editingName.trim() });
    }
    setEditingId(null);
    setEditingName("");
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

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="settings-screen">
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Manage your habits & categories</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAdd(true)}
          testID="add-habit-button"
        >
          <Ionicons name="add" size={20} color={theme.colors.bg} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {Object.keys(grouped).map((cat) => (
          <View key={cat} style={styles.group}>
            <View style={styles.groupHeader}>
              <View style={[styles.catDot, { backgroundColor: categoryColor(cat) }]} />
              <Text style={styles.groupLabel}>{cat.toUpperCase()}</Text>
              <Text style={styles.groupCount}>{grouped[cat].length}</Text>
            </View>
            {grouped[cat].map((h) => (
              <View key={h.id} style={styles.row}>
                {editingId === h.id ? (
                  <TextInput
                    style={styles.editInput}
                    value={editingName}
                    onChangeText={setEditingName}
                    autoFocus
                    onBlur={handleRenameSave}
                    onSubmitEditing={handleRenameSave}
                    placeholder="Habit name"
                    placeholderTextColor={theme.colors.textMuted}
                    testID={`edit-input-${h.id}`}
                  />
                ) : (
                  <TouchableOpacity
                    style={styles.rowName}
                    onPress={() => {
                      setEditingId(h.id);
                      setEditingName(h.name);
                    }}
                    testID={`edit-habit-${h.id}`}
                  >
                    <Text style={styles.habitName}>{h.name}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => handleDelete(h.id)}
                  style={styles.delBtn}
                  testID={`delete-habit-${h.id}`}
                >
                  <Ionicons name="trash-outline" size={18} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}

        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>Life Analytics Dashboard</Text>
          <Text style={styles.aboutText}>
            Track your habits in under 30 seconds. Every check-in updates your Life Score, streaks, trends, and correlations automatically.
          </Text>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Habit</Text>
                <TouchableOpacity onPress={() => setShowAdd(false)} testID="close-add-modal">
                  <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>NAME</Text>
              <TextInput
                style={styles.input}
                value={newName}
                onChangeText={setNewName}
                placeholder="e.g. Morning Walk"
                placeholderTextColor={theme.colors.textMuted}
                testID="new-habit-name-input"
              />

              <Text style={styles.fieldLabel}>CATEGORY</Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setShowCatPicker((s) => !s)}
                testID="category-picker-button"
              >
                <View style={[styles.catDot, { backgroundColor: categoryColor(customCat.trim() || newCategory) }]} />
                <Text style={styles.pickerText}>{customCat.trim() || newCategory}</Text>
                <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>

              {showCatPicker && (
                <View style={styles.pickerList}>
                  {categories.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={styles.pickerItem}
                      onPress={() => {
                        setNewCategory(c);
                        setCustomCat("");
                        setShowCatPicker(false);
                      }}
                    >
                      <View style={[styles.catDot, { backgroundColor: categoryColor(c) }]} />
                      <Text style={styles.pickerItemText}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                  <TextInput
                    style={[styles.input, { marginTop: 8 }]}
                    value={customCat}
                    onChangeText={setCustomCat}
                    placeholder="Or type a new category"
                    placeholderTextColor={theme.colors.textMuted}
                    testID="new-category-input"
                  />
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, (saving || !newName.trim()) && { opacity: 0.5 }]}
                onPress={handleAdd}
                disabled={saving || !newName.trim()}
                testID="save-habit-button"
              >
                {saving ? (
                  <ActivityIndicator color={theme.colors.bg} />
                ) : (
                  <Text style={styles.primaryBtnText}>Add Habit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { color: theme.colors.textPrimary, fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  subtitle: { color: theme.colors.textSecondary, fontSize: 14, marginTop: 4 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  group: { marginBottom: 20 },
  groupHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  catDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  groupLabel: { color: theme.colors.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1.5, flex: 1 },
  groupCount: { color: theme.colors.textSecondary, fontSize: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowName: { flex: 1 },
  habitName: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: "500" },
  editInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "500",
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  delBtn: { padding: 8 },
  aboutCard: {
    marginTop: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
  },
  aboutTitle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: "700" },
  aboutText: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 20 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: "700" },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.textPrimary,
    fontSize: 15,
  },
  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerText: { color: theme.colors.textPrimary, fontSize: 15, flex: 1 },
  pickerList: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 8,
    marginTop: 8,
  },
  pickerItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 8 },
  pickerItemText: { color: theme.colors.textPrimary, fontSize: 15 },
  primaryBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  primaryBtnText: { color: theme.colors.bg, fontSize: 15, fontWeight: "700" },
});
