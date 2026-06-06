# Life Analytics Dashboard — PRD

## Overview
A single-user mobile-first PWA (Expo + FastAPI + MongoDB) for sub-30-second daily habit check-ins that auto-generates analytics, scores, trends, correlations, and predictions.

## Stack
- **Frontend**: Expo Router (file-based) + React Native, react-native-svg for visualizations
- **Backend**: FastAPI + Motor (async MongoDB)
- **DB**: MongoDB (flexible schema — habits/checkins as documents, no fixed columns per habit)

## Screens
1. **Dashboard** (`/(tabs)/index`) — Life Score ring, current/best streak, category scores grid, 6-month heatmap, today summary.
2. **Daily Check-In** (`/(tabs)/check-in`) — Habits grouped by category with circular checkboxes + sticky "Save Day" button. Updates analytics instantly.
3. **Insights** (`/(tabs)/insights`) — Narrative bullets, 12-week trend chart, next-week prediction, top habits, correlations.
4. **History** (`/(tabs)/history`) — Timeline of past days with per-category dots and overall score.
5. **Settings** (`/(tabs)/settings`) — Add/edit/delete habits & custom categories.

## Data Model
- `habits`: `{ id, name, category, icon?, archived, created_at }`
- `checkins`: `{ id, date (YYYY-MM-DD, unique), completed_habit_ids[], mood?, energy?, notes?, timestamp }`

## API
- `GET/POST/PUT/DELETE /api/habits[...]`
- `GET /api/checkins`, `GET /api/checkins/{date}`, `POST /api/checkins` (idempotent upsert by date)
- `GET /api/analytics/dashboard` — life_score, category_scores, current_streak, best_streak, heatmap (180d), habit_streaks
- `GET /api/analytics/insights` — weekly_trend (12w), habit_frequency (30d), correlations (Pearson, abs ≥ 0.4), narratives, prediction

## Scoring Rules
- Life Score = avg overall % completion across last 30 days (0-100).
- Category Score = avg of that category's daily completion % across last 30 days.
- Current streak = consecutive days with any habit completed (ending today or yesterday).

## Not in v1
- AI insights, multi-user auth, notifications, mood/energy UI (fields stored but unused).
