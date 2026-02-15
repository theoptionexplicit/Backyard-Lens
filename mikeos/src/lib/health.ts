import { v4 as uuid } from 'uuid';
import { getDb } from './db';
import type { HealthEntry, MoodEntry, SleepEntry, WeeklyTrend } from '@/types';

// Quick phrase calorie parser: "eggs and toast ~350cal" -> 350
function parseCalories(phrase: string): number | null {
  // Match patterns like "350cal", "~350", "350 calories", "350 kcal"
  const match = phrase.match(/~?(\d+)\s*(?:cal|kcal|calories)?/i);
  if (match) return parseInt(match[1], 10);

  // Common food estimates
  const estimates: Record<string, number> = {
    'coffee': 5, 'black coffee': 5, 'latte': 190, 'cappuccino': 120,
    'eggs': 140, 'egg': 70, 'toast': 80, 'bagel': 250,
    'sandwich': 400, 'salad': 250, 'soup': 200,
    'chicken breast': 280, 'steak': 400, 'salmon': 350,
    'rice': 200, 'pasta': 350, 'pizza slice': 285,
    'banana': 105, 'apple': 95, 'orange': 65,
    'yogurt': 150, 'oatmeal': 300, 'cereal': 250,
    'burger': 550, 'fries': 365, 'taco': 210,
    'beer': 150, 'wine': 125, 'soda': 140,
    'protein shake': 250, 'smoothie': 300,
    'snack': 200, 'cookie': 150, 'candy bar': 250,
  };

  const lower = phrase.toLowerCase();
  for (const [food, cal] of Object.entries(estimates)) {
    if (lower.includes(food)) return cal;
  }

  return null;
}

export function logMeal(phrase: string, date?: string): HealthEntry {
  const db = getDb();
  const entry: HealthEntry = {
    id: uuid(),
    date: date || new Date().toISOString().split('T')[0],
    type: 'meal',
    value: phrase,
    calories: parseCalories(phrase) || undefined,
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    'INSERT INTO health_entries (id, date, type, value, calories, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(entry.id, entry.date, entry.type, entry.value, entry.calories || null, entry.createdAt);

  return entry;
}

export function logSymptom(description: string, date?: string): HealthEntry {
  const db = getDb();
  const entry: HealthEntry = {
    id: uuid(),
    date: date || new Date().toISOString().split('T')[0],
    type: 'symptom',
    value: description,
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    'INSERT INTO health_entries (id, date, type, value, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(entry.id, entry.date, entry.type, entry.value, entry.createdAt);

  return entry;
}

export function logMed(medication: string, date?: string): HealthEntry {
  const db = getDb();
  const entry: HealthEntry = {
    id: uuid(),
    date: date || new Date().toISOString().split('T')[0],
    type: 'med',
    value: medication,
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    'INSERT INTO health_entries (id, date, type, value, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(entry.id, entry.date, entry.type, entry.value, entry.createdAt);

  return entry;
}

export function logMood(mood: number, energy: number, anxiety: number, notes?: string, date?: string): MoodEntry {
  const db = getDb();
  const entry: MoodEntry = {
    id: uuid(),
    date: date || new Date().toISOString().split('T')[0],
    mood: Math.max(1, Math.min(10, mood)),
    energy: Math.max(1, Math.min(10, energy)),
    anxiety: Math.max(1, Math.min(10, anxiety)),
    notes,
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    'INSERT INTO mood_entries (id, date, mood, energy, anxiety, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(entry.id, entry.date, entry.mood, entry.energy, entry.anxiety, entry.notes || null, entry.createdAt);

  return entry;
}

export function logSleep(hours: number, quality: number, bedtime?: string, wakeTime?: string, notes?: string, date?: string): SleepEntry {
  const db = getDb();
  const entry: SleepEntry = {
    id: uuid(),
    date: date || new Date().toISOString().split('T')[0],
    hours,
    quality: Math.max(1, Math.min(10, quality)),
    bedtime,
    wakeTime,
    notes,
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    'INSERT INTO sleep_entries (id, date, hours, quality, bedtime, wake_time, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(entry.id, entry.date, entry.hours, entry.quality, entry.bedtime || null, entry.wakeTime || null, entry.notes || null, entry.createdAt);

  return entry;
}

export function getDailyCalories(date: string): { total: number; entries: HealthEntry[] } {
  const db = getDb();
  const entries = db.prepare(
    "SELECT * FROM health_entries WHERE date = ? AND type = 'meal' ORDER BY created_at"
  ).all(date) as Array<{ id: string; date: string; type: string; value: string; calories: number | null; notes: string; created_at: string }>;

  const mapped: HealthEntry[] = entries.map(e => ({
    id: e.id, date: e.date, type: e.type as HealthEntry['type'],
    value: e.value, calories: e.calories || undefined,
    notes: e.notes, createdAt: e.created_at,
  }));

  const total = mapped.reduce((sum, e) => sum + (e.calories || 0), 0);
  return { total, entries: mapped };
}

export function getWeeklyTrends(weekStart: string): WeeklyTrend {
  const db = getDb();

  // Get 7 days of data
  const moods = db.prepare(
    'SELECT AVG(mood) as avg_mood, AVG(energy) as avg_energy FROM mood_entries WHERE date >= ? AND date < date(?, \'+7 days\')'
  ).get(weekStart, weekStart) as { avg_mood: number | null; avg_energy: number | null };

  const sleep = db.prepare(
    'SELECT AVG(hours) as avg_sleep FROM sleep_entries WHERE date >= ? AND date < date(?, \'+7 days\')'
  ).get(weekStart, weekStart) as { avg_sleep: number | null };

  const calories = db.prepare(
    'SELECT SUM(calories) as total_cal, AVG(calories) as avg_cal FROM health_entries WHERE date >= ? AND date < date(?, \'+7 days\') AND type = \'meal\''
  ).get(weekStart, weekStart) as { total_cal: number | null; avg_cal: number | null };

  const symptoms = db.prepare(
    'SELECT COUNT(*) as count FROM health_entries WHERE date >= ? AND date < date(?, \'+7 days\') AND type = \'symptom\''
  ).get(weekStart, weekStart) as { count: number };

  const tasksCompleted = db.prepare(
    'SELECT COUNT(*) as count FROM tasks WHERE completed = 1 AND completed_at >= ? AND completed_at < date(?, \'+7 days\')'
  ).get(weekStart, weekStart) as { count: number };

  // Simple correlations
  const correlations: string[] = [];
  if (moods.avg_mood && moods.avg_energy) {
    if (moods.avg_mood >= 7) correlations.push('Mood has been solid this week');
    if (moods.avg_mood < 5) correlations.push('Mood has been lower than usual');
    if (moods.avg_energy < 5 && sleep.avg_sleep && sleep.avg_sleep < 7) {
      correlations.push('Low energy correlates with less sleep');
    }
  }
  if (symptoms.count > 3) correlations.push('More symptoms than usual — check med/food patterns');
  if (tasksCompleted.count > 10) correlations.push('Productive week — nice work');

  return {
    weekStart,
    avgMood: moods.avg_mood ? Math.round(moods.avg_mood * 10) / 10 : 0,
    avgEnergy: moods.avg_energy ? Math.round(moods.avg_energy * 10) / 10 : 0,
    avgSleep: sleep.avg_sleep ? Math.round(sleep.avg_sleep * 10) / 10 : 0,
    totalCalories: calories.total_cal || 0,
    avgCalories: calories.avg_cal ? Math.round(calories.avg_cal) : 0,
    symptomsCount: symptoms.count,
    tasksCompleted: tasksCompleted.count,
    correlations,
  };
}

export function getHealthEntriesForDate(date: string): HealthEntry[] {
  const db = getDb();
  return db.prepare(
    'SELECT id, date, type, value, calories, notes, created_at as createdAt FROM health_entries WHERE date = ? ORDER BY created_at'
  ).all(date) as HealthEntry[];
}

export function getMoodForDate(date: string): MoodEntry | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT id, date, mood, energy, anxiety, notes, created_at as createdAt FROM mood_entries WHERE date = ? ORDER BY created_at DESC LIMIT 1'
  ).get(date);
  return (row as MoodEntry) || null;
}

export function getSleepForDate(date: string): SleepEntry | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT id, date, hours, quality, bedtime, wake_time as wakeTime, notes, created_at as createdAt FROM sleep_entries WHERE date = ? ORDER BY created_at DESC LIMIT 1'
  ).get(date);
  return (row as SleepEntry) || null;
}
