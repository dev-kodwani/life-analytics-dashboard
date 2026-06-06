from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, date, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ===== Models =====
class Habit(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    category: str
    icon: Optional[str] = None
    archived: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class HabitCreate(BaseModel):
    name: str
    category: str
    icon: Optional[str] = None


class HabitUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    icon: Optional[str] = None
    archived: Optional[bool] = None


class CheckIn(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str  # YYYY-MM-DD
    completed_habit_ids: List[str] = []
    mood: Optional[int] = None
    energy: Optional[int] = None
    notes: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CheckInCreate(BaseModel):
    date: str
    completed_habit_ids: List[str] = []
    mood: Optional[int] = None
    energy: Optional[int] = None
    notes: Optional[str] = None


# ===== Defaults =====
DEFAULT_HABITS = [
    ("Exercise", "Health"),
    ("Sleep 8 Hours", "Health"),
    ("Drink Enough Water", "Health"),
    ("Healthy Eating", "Health"),
    ("Study", "Learning"),
    ("Read", "Learning"),
    ("Learn Something New", "Learning"),
    ("Coding", "Career"),
    ("Project Work", "Career"),
    ("Networking", "Career"),
    ("Meditation", "Personal Growth"),
    ("Journal", "Personal Growth"),
    ("Reflection", "Personal Growth"),
    ("Expense Tracking", "Money"),
    ("Finance Learning", "Money"),
]


async def ensure_seeded():
    count = await db.habits.count_documents({})
    if count == 0:
        docs = [
            Habit(name=n, category=c).dict() for n, c in DEFAULT_HABITS
        ]
        await db.habits.insert_many(docs)
        logger.info(f"Seeded {len(docs)} default habits")


# ===== Habits =====
@api_router.get("/habits", response_model=List[Habit])
async def list_habits(include_archived: bool = False):
    await ensure_seeded()
    q: Dict[str, Any] = {} if include_archived else {"archived": False}
    cursor = db.habits.find(q, {"_id": 0}).sort("created_at", 1)
    items = await cursor.to_list(1000)
    return [Habit(**i) for i in items]


@api_router.post("/habits", response_model=Habit)
async def create_habit(payload: HabitCreate):
    habit = Habit(**payload.dict())
    await db.habits.insert_one(habit.dict())
    return habit


@api_router.put("/habits/{habit_id}", response_model=Habit)
async def update_habit(habit_id: str, payload: HabitUpdate):
    update = {k: v for k, v in payload.dict().items() if v is not None}
    if not update:
        existing = await db.habits.find_one({"id": habit_id}, {"_id": 0})
        if not existing:
            raise HTTPException(404, "Habit not found")
        return Habit(**existing)
    result = await db.habits.update_one({"id": habit_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(404, "Habit not found")
    doc = await db.habits.find_one({"id": habit_id}, {"_id": 0})
    return Habit(**doc)


@api_router.delete("/habits/{habit_id}")
async def delete_habit(habit_id: str):
    result = await db.habits.delete_one({"id": habit_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Habit not found")
    return {"ok": True}


# ===== Check-ins =====
@api_router.get("/checkins")
async def list_checkins(start: Optional[str] = None, end: Optional[str] = None):
    q: Dict[str, Any] = {}
    if start or end:
        q["date"] = {}
        if start:
            q["date"]["$gte"] = start
        if end:
            q["date"]["$lte"] = end
    cursor = db.checkins.find(q, {"_id": 0}).sort("date", -1)
    items = await cursor.to_list(2000)
    return items


@api_router.get("/checkins/{date_str}")
async def get_checkin(date_str: str):
    doc = await db.checkins.find_one({"date": date_str}, {"_id": 0})
    return doc or {"date": date_str, "completed_habit_ids": [], "exists": False}


@api_router.post("/checkins", response_model=CheckIn)
async def upsert_checkin(payload: CheckInCreate):
    existing = await db.checkins.find_one({"date": payload.date}, {"_id": 0})
    data = payload.dict()
    data["timestamp"] = datetime.now(timezone.utc).isoformat()
    if existing:
        await db.checkins.update_one({"date": payload.date}, {"$set": data})
        merged = {**existing, **data}
        return CheckIn(**merged)
    new_obj = CheckIn(**data)
    await db.checkins.insert_one(new_obj.dict())
    return new_obj


@api_router.delete("/checkins/{date_str}")
async def delete_checkin(date_str: str):
    await db.checkins.delete_one({"date": date_str})
    return {"ok": True}


# ===== Analytics =====
def _score_for_day(completed_ids: List[str], habit_ids_by_cat: Dict[str, List[str]]) -> Dict[str, float]:
    """Returns per-category percent + overall."""
    result: Dict[str, float] = {}
    overall_total = 0
    overall_done = 0
    for cat, ids in habit_ids_by_cat.items():
        if not ids:
            result[cat] = 0.0
            continue
        done = sum(1 for i in ids if i in completed_ids)
        result[cat] = round((done / len(ids)) * 100, 1)
        overall_total += len(ids)
        overall_done += done
    result["overall"] = round((overall_done / overall_total) * 100, 1) if overall_total else 0.0
    return result


@api_router.get("/analytics/dashboard")
async def analytics_dashboard():
    await ensure_seeded()
    habits = await db.habits.find({"archived": False}, {"_id": 0}).to_list(1000)
    habit_ids_by_cat: Dict[str, List[str]] = {}
    habit_by_id: Dict[str, Dict[str, Any]] = {}
    for h in habits:
        habit_ids_by_cat.setdefault(h["category"], []).append(h["id"])
        habit_by_id[h["id"]] = h

    today = date.today()
    today_str = today.isoformat()

    # Today snapshot
    today_doc = await db.checkins.find_one({"date": today_str}, {"_id": 0})
    today_completed = today_doc["completed_habit_ids"] if today_doc else []
    today_scores = _score_for_day(today_completed, habit_ids_by_cat)

    # Last 30 days for rolling life score
    start_30 = (today - timedelta(days=29)).isoformat()
    docs_30 = await db.checkins.find(
        {"date": {"$gte": start_30, "$lte": today_str}}, {"_id": 0}
    ).to_list(2000)
    by_date = {d["date"]: d for d in docs_30}

    rolling_scores: List[float] = []
    cat_rolling: Dict[str, List[float]] = {c: [] for c in habit_ids_by_cat.keys()}
    for i in range(30):
        d = (today - timedelta(days=29 - i)).isoformat()
        doc = by_date.get(d)
        cids = doc["completed_habit_ids"] if doc else []
        s = _score_for_day(cids, habit_ids_by_cat)
        rolling_scores.append(s["overall"])
        for c in habit_ids_by_cat.keys():
            cat_rolling[c].append(s[c])

    life_score = round(sum(rolling_scores) / len(rolling_scores), 1) if rolling_scores else 0.0
    category_scores = {
        c: round(sum(v) / len(v), 1) if v else 0.0 for c, v in cat_rolling.items()
    }

    # Streaks: consecutive days where overall > 0 ending today (or yesterday)
    all_docs = await db.checkins.find({}, {"_id": 0}).sort("date", -1).to_list(2000)
    completed_by_date = {d["date"]: d["completed_habit_ids"] for d in all_docs}

    current_streak = 0
    cursor_date = today
    # allow streak to start yesterday if today not done yet
    if today_str not in completed_by_date or not _score_for_day(
        completed_by_date.get(today_str, []), habit_ids_by_cat
    )["overall"]:
        cursor_date = today - timedelta(days=1)
    while True:
        ds = cursor_date.isoformat()
        cids = completed_by_date.get(ds)
        if cids is None:
            break
        if _score_for_day(cids, habit_ids_by_cat)["overall"] <= 0:
            break
        current_streak += 1
        cursor_date -= timedelta(days=1)

    # Best streak
    best_streak = 0
    if completed_by_date:
        sorted_dates = sorted(completed_by_date.keys())
        run = 0
        prev: Optional[date] = None
        for ds in sorted_dates:
            cur = date.fromisoformat(ds)
            score = _score_for_day(completed_by_date[ds], habit_ids_by_cat)["overall"]
            if score <= 0:
                run = 0
                prev = cur
                continue
            if prev is None or (cur - prev).days == 1:
                run += 1 if prev is not None or run == 0 else 1
                # simpler: rebuild run
            else:
                run = 1
            prev = cur
            best_streak = max(best_streak, run)
        # Recompute best streak cleanly
        best_streak = 0
        run = 0
        prev = None
        for ds in sorted_dates:
            cur = date.fromisoformat(ds)
            score = _score_for_day(completed_by_date[ds], habit_ids_by_cat)["overall"]
            if score <= 0:
                run = 0
                prev = None
                continue
            if prev is not None and (cur - prev).days == 1:
                run += 1
            else:
                run = 1
            prev = cur
            best_streak = max(best_streak, run)

    # Heatmap: last 180 days
    start_hm = today - timedelta(days=179)
    heatmap = []
    for i in range(180):
        d = (start_hm + timedelta(days=i)).isoformat()
        cids = completed_by_date.get(d, [])
        s = _score_for_day(cids, habit_ids_by_cat)["overall"]
        if s == 0:
            level = 0
        elif s < 25:
            level = 1
        elif s < 50:
            level = 2
        elif s < 75:
            level = 3
        else:
            level = 4
        heatmap.append({"date": d, "level": level, "score": s})

    # Per-habit streaks
    habit_streaks: Dict[str, int] = {}
    for h in habits:
        hid = h["id"]
        c = 0
        cd = today
        if today_str in completed_by_date and hid in completed_by_date[today_str]:
            pass
        else:
            cd = today - timedelta(days=1)
        while True:
            ds = cd.isoformat()
            cids = completed_by_date.get(ds)
            if cids is None or hid not in cids:
                break
            c += 1
            cd -= timedelta(days=1)
        habit_streaks[hid] = c

    return {
        "today": today_str,
        "today_scores": today_scores,
        "today_completed_ids": today_completed,
        "life_score": life_score,
        "category_scores": category_scores,
        "current_streak": current_streak,
        "best_streak": best_streak,
        "heatmap": heatmap,
        "habit_streaks": habit_streaks,
        "total_habits": sum(len(v) for v in habit_ids_by_cat.values()),
    }


@api_router.get("/analytics/insights")
async def analytics_insights():
    habits = await db.habits.find({"archived": False}, {"_id": 0}).to_list(1000)
    habit_by_id = {h["id"]: h for h in habits}
    habit_ids_by_cat: Dict[str, List[str]] = {}
    for h in habits:
        habit_ids_by_cat.setdefault(h["category"], []).append(h["id"])

    today = date.today()
    start = (today - timedelta(days=89)).isoformat()
    docs = await db.checkins.find(
        {"date": {"$gte": start}}, {"_id": 0}
    ).sort("date", 1).to_list(2000)

    # Weekly trend (last 12 weeks)
    weekly: Dict[str, List[float]] = {}
    for i in range(12):
        week_end = today - timedelta(days=i * 7)
        week_start = week_end - timedelta(days=6)
        wk_label = week_start.isoformat()
        weekly[wk_label] = []
    weekly_trend = []
    for i in range(12):
        week_end = today - timedelta(days=(11 - i) * 7)
        week_start = week_end - timedelta(days=6)
        ws = week_start.isoformat()
        we = week_end.isoformat()
        wk_docs = [d for d in docs if ws <= d["date"] <= we]
        scores = [_score_for_day(d["completed_habit_ids"], habit_ids_by_cat)["overall"] for d in wk_docs]
        avg = round(sum(scores) / len(scores), 1) if scores else 0.0
        weekly_trend.append({"week": ws, "score": avg, "entries": len(wk_docs)})

    # Habit frequency (last 30 days)
    last_30 = (today - timedelta(days=29)).isoformat()
    recent_docs = [d for d in docs if d["date"] >= last_30]
    freq: Dict[str, int] = {h["id"]: 0 for h in habits}
    for d in recent_docs:
        for hid in d["completed_habit_ids"]:
            if hid in freq:
                freq[hid] += 1
    habit_frequency = sorted(
        [
            {
                "habit_id": hid,
                "name": habit_by_id[hid]["name"],
                "category": habit_by_id[hid]["category"],
                "count": cnt,
                "percent": round((cnt / max(len(recent_docs), 1)) * 100, 1),
            }
            for hid, cnt in freq.items()
        ],
        key=lambda x: -x["count"],
    )

    # Correlations (Pearson-like). For each habit pair, compute correlation over recent days.
    correlations = []
    if len(recent_docs) >= 5 and len(habits) >= 2:
        habit_ids = [h["id"] for h in habits]
        vectors: Dict[str, List[int]] = {hid: [] for hid in habit_ids}
        for d in recent_docs:
            done = set(d["completed_habit_ids"])
            for hid in habit_ids:
                vectors[hid].append(1 if hid in done else 0)

        def corr(x: List[int], y: List[int]) -> float:
            n = len(x)
            if n == 0:
                return 0.0
            mx = sum(x) / n
            my = sum(y) / n
            num = sum((xi - mx) * (yi - my) for xi, yi in zip(x, y))
            denx = sum((xi - mx) ** 2 for xi in x) ** 0.5
            deny = sum((yi - my) ** 2 for yi in y) ** 0.5
            if denx == 0 or deny == 0:
                return 0.0
            return num / (denx * deny)

        pairs = []
        for i in range(len(habit_ids)):
            for j in range(i + 1, len(habit_ids)):
                a, b = habit_ids[i], habit_ids[j]
                c = corr(vectors[a], vectors[b])
                if abs(c) >= 0.4:
                    pairs.append(
                        {
                            "habit_a": habit_by_id[a]["name"],
                            "habit_b": habit_by_id[b]["name"],
                            "category_a": habit_by_id[a]["category"],
                            "category_b": habit_by_id[b]["category"],
                            "correlation": round(c, 2),
                        }
                    )
        pairs.sort(key=lambda p: -abs(p["correlation"]))
        correlations = pairs[:8]

    # Simple narrative insights
    narratives: List[str] = []
    if weekly_trend:
        last = weekly_trend[-1]["score"]
        prev = weekly_trend[-2]["score"] if len(weekly_trend) > 1 else 0
        if last > prev + 5:
            narratives.append(f"You're on an upswing — this week is {round(last - prev, 1)}% higher than last week.")
        elif last < prev - 5:
            narratives.append(f"Heads up: this week dipped {round(prev - last, 1)}% vs last week.")
        else:
            narratives.append("Your weekly performance is steady. Consistency beats intensity.")
    if habit_frequency:
        top = habit_frequency[0]
        if top["count"] > 0:
            narratives.append(f"Most consistent habit (30d): {top['name']} — {top['percent']}% of days.")
        bottom = [h for h in habit_frequency if h["count"] >= 0][-1]
        narratives.append(f"Least-touched habit (30d): {bottom['name']}. A small nudge could move the needle.")
    if correlations:
        top_corr = correlations[0]
        sign = "rise together" if top_corr["correlation"] > 0 else "trade off"
        narratives.append(
            f"{top_corr['habit_a']} and {top_corr['habit_b']} tend to {sign} (r = {top_corr['correlation']})."
        )

    # Prediction: next week's expected score = trend slope
    prediction = None
    if len([w for w in weekly_trend if w["entries"] > 0]) >= 3:
        ys = [w["score"] for w in weekly_trend]
        n = len(ys)
        xs = list(range(n))
        mx = sum(xs) / n
        my = sum(ys) / n
        num = sum((xi - mx) * (yi - my) for xi, yi in zip(xs, ys))
        den = sum((xi - mx) ** 2 for xi in xs)
        slope = num / den if den else 0
        intercept = my - slope * mx
        next_x = n
        predicted = max(0, min(100, round(slope * next_x + intercept, 1)))
        prediction = {"next_week_score": predicted, "slope_per_week": round(slope, 2)}

    return {
        "weekly_trend": weekly_trend,
        "habit_frequency": habit_frequency,
        "correlations": correlations,
        "narratives": narratives,
        "prediction": prediction,
    }


@api_router.get("/")
async def root():
    return {"message": "Life Analytics Dashboard API", "ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
