const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${res.status} ${txt}`);
  }
  return (await res.json()) as T;
}

export type Habit = {
  id: string;
  name: string;
  category: string;
  icon?: string | null;
  archived: boolean;
  created_at: string;
};

export type CheckIn = {
  id?: string;
  date: string;
  completed_habit_ids: string[];
  mood?: number | null;
  energy?: number | null;
  notes?: string | null;
};

export type DashboardData = {
  today: string;
  today_scores: Record<string, number>;
  today_completed_ids: string[];
  life_score: number;
  category_scores: Record<string, number>;
  current_streak: number;
  best_streak: number;
  heatmap: { date: string; level: number; score: number }[];
  habit_streaks: Record<string, number>;
  total_habits: number;
};

export type InsightsData = {
  weekly_trend: { week: string; score: number; entries: number }[];
  habit_frequency: { habit_id: string; name: string; category: string; count: number; percent: number }[];
  correlations: { habit_a: string; habit_b: string; category_a: string; category_b: string; correlation: number }[];
  narratives: string[];
  prediction: { next_week_score: number; slope_per_week: number } | null;
};

export const api = {
  listHabits: () => request<Habit[]>("/habits"),
  createHabit: (payload: { name: string; category: string }) =>
    request<Habit>("/habits", { method: "POST", body: JSON.stringify(payload) }),
  updateHabit: (id: string, payload: Partial<Habit>) =>
    request<Habit>(`/habits/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteHabit: (id: string) => request<{ ok: boolean }>(`/habits/${id}`, { method: "DELETE" }),

  getCheckin: (date: string) =>
    request<CheckIn & { exists?: boolean }>(`/checkins/${date}`),
  upsertCheckin: (payload: CheckIn) =>
    request<CheckIn>("/checkins", { method: "POST", body: JSON.stringify(payload) }),
  listCheckins: (params: { start?: string; end?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.start) q.set("start", params.start);
    if (params.end) q.set("end", params.end);
    const qs = q.toString();
    return request<CheckIn[]>(`/checkins${qs ? `?${qs}` : ""}`);
  },

  dashboard: () => request<DashboardData>("/analytics/dashboard"),
  insights: () => request<InsightsData>("/analytics/insights"),
};

export const todayString = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
