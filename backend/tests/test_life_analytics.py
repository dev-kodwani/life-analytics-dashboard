"""Backend tests for Life Analytics Dashboard."""
import os
import pytest
import requests
from datetime import date

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# Habits CRUD + seeding
class TestHabits:
    def test_list_seeded_15(self, s):
        r = s.get(f"{API}/habits", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 15
        cats = {h["category"] for h in data}
        for required in ["Health", "Learning", "Career", "Personal Growth", "Money"]:
            assert required in cats, f"Missing category {required}"

    def test_create_update_delete(self, s):
        r = s.post(f"{API}/habits", json={"name": "TEST_Custom", "category": "TEST_Cat"})
        assert r.status_code == 200
        hid = r.json()["id"]
        assert r.json()["name"] == "TEST_Custom"

        r2 = s.put(f"{API}/habits/{hid}", json={"name": "TEST_Renamed"})
        assert r2.status_code == 200
        assert r2.json()["name"] == "TEST_Renamed"

        # Verify via GET
        rl = s.get(f"{API}/habits")
        found = [h for h in rl.json() if h["id"] == hid]
        assert found and found[0]["name"] == "TEST_Renamed"

        rd = s.delete(f"{API}/habits/{hid}")
        assert rd.status_code == 200
        rl2 = s.get(f"{API}/habits")
        assert not [h for h in rl2.json() if h["id"] == hid]

    def test_update_404(self, s):
        r = s.put(f"{API}/habits/nonexistent-id-xxx", json={"name": "x"})
        assert r.status_code == 404


# Check-ins upsert
class TestCheckins:
    def test_upsert_no_duplicate(self, s):
        today = date.today().isoformat()
        habits = s.get(f"{API}/habits").json()
        ids = [h["id"] for h in habits[:3]]

        r1 = s.post(f"{API}/checkins", json={"date": today, "completed_habit_ids": ids[:2]})
        assert r1.status_code == 200
        r2 = s.post(f"{API}/checkins", json={"date": today, "completed_habit_ids": ids})
        assert r2.status_code == 200

        # GET returns merged latest
        rg = s.get(f"{API}/checkins/{today}")
        assert rg.status_code == 200
        assert set(rg.json()["completed_habit_ids"]) == set(ids)

        # List filter — only one record for that date
        rl = s.get(f"{API}/checkins", params={"start": today, "end": today})
        assert rl.status_code == 200
        items = rl.json()
        same_date = [i for i in items if i["date"] == today]
        assert len(same_date) == 1, f"Expected 1 record for {today}, got {len(same_date)}"

    def test_get_missing_returns_default(self, s):
        r = s.get(f"{API}/checkins/1999-01-01")
        assert r.status_code == 200
        data = r.json()
        assert data.get("exists") is False or data.get("completed_habit_ids") == []


# Analytics
class TestAnalytics:
    def test_dashboard_shape(self, s):
        r = s.get(f"{API}/analytics/dashboard", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for key in ["life_score", "category_scores", "current_streak", "best_streak",
                    "heatmap", "today_completed_ids", "today_scores"]:
            assert key in d, f"Missing key {key}"
        assert len(d["heatmap"]) == 180
        assert isinstance(d["category_scores"], dict)
        assert isinstance(d["current_streak"], int)
        assert isinstance(d["best_streak"], int)

    def test_dashboard_reflects_checkin(self, s):
        today = date.today().isoformat()
        habits = s.get(f"{API}/habits").json()
        ids = [h["id"] for h in habits[:5]]
        s.post(f"{API}/checkins", json={"date": today, "completed_habit_ids": ids})

        r = s.get(f"{API}/analytics/dashboard").json()
        assert set(ids).issubset(set(r["today_completed_ids"]))
        assert r["today_scores"]["overall"] > 0

    def test_insights_shape(self, s):
        r = s.get(f"{API}/analytics/insights", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ["weekly_trend", "habit_frequency", "correlations", "narratives", "prediction"]:
            assert k in d
        assert len(d["weekly_trend"]) == 12
        assert isinstance(d["habit_frequency"], list)
        assert isinstance(d["correlations"], list)
        assert isinstance(d["narratives"], list)


# New feature tests: mood/energy/notes persistence on check-ins
class TestCheckinExtras:
    def test_checkin_with_mood_energy_notes_persists(self, s):
        today = date.today().isoformat()
        habits = s.get(f"{API}/habits").json()
        ids = [h["id"] for h in habits[:2]]

        payload = {
            "date": today,
            "completed_habit_ids": ids,
            "mood": 4,
            "energy": 3,
            "notes": "TEST_note feeling good",
        }
        r = s.post(f"{API}/checkins", json=payload)
        assert r.status_code == 200
        body = r.json()
        assert body["mood"] == 4
        assert body["energy"] == 3
        assert body["notes"] == "TEST_note feeling good"

        # Verify persistence via GET
        rg = s.get(f"{API}/checkins/{today}")
        assert rg.status_code == 200
        got = rg.json()
        assert got["mood"] == 4
        assert got["energy"] == 3
        assert got["notes"] == "TEST_note feeling good"
        assert set(got["completed_habit_ids"]) == set(ids)

    def test_checkin_update_clears_notes(self, s):
        today = date.today().isoformat()
        habits = s.get(f"{API}/habits").json()
        ids = [h["id"] for h in habits[:1]]
        # Set notes then clear
        s.post(f"{API}/checkins", json={"date": today, "completed_habit_ids": ids, "notes": "TEST_x"})
        r = s.post(f"{API}/checkins", json={"date": today, "completed_habit_ids": ids, "notes": None})
        assert r.status_code == 200
        rg = s.get(f"{API}/checkins/{today}").json()
        assert rg.get("notes") in (None, "")


# Category change moves habit between groups
class TestCategoryChange:
    def test_update_habit_category(self, s):
        # Create
        r = s.post(f"{API}/habits", json={"name": "TEST_MoveMe", "category": "Health"})
        assert r.status_code == 200
        hid = r.json()["id"]
        assert r.json()["category"] == "Health"

        # Change category
        r2 = s.put(f"{API}/habits/{hid}", json={"category": "Career"})
        assert r2.status_code == 200
        assert r2.json()["category"] == "Career"

        # Verify via list
        lst = s.get(f"{API}/habits").json()
        found = [h for h in lst if h["id"] == hid]
        assert found and found[0]["category"] == "Career"

        # Cleanup
        s.delete(f"{API}/habits/{hid}")


# Regression: dashboard still returns habit_streaks
class TestDashboardHabitStreaks:
    def test_dashboard_has_habit_streaks(self, s):
        r = s.get(f"{API}/analytics/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "habit_streaks" in d
        assert isinstance(d["habit_streaks"], dict)
        # Every habit id should be a key
        habits = s.get(f"{API}/habits").json()
        for h in habits:
            assert h["id"] in d["habit_streaks"]
            assert isinstance(d["habit_streaks"][h["id"]], int)
