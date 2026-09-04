import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Default location: ~/.quantified-claude/feature-store.sqlite
const QC_DB_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || '/tmp',
  '.quantified-claude',
  'feature-store.sqlite'
);

let qcDb: Database.Database | null = null;
let qcAvailable = false;

function getQcDb(): Database.Database | null {
  if (qcDb) return qcDb;
  if (!fs.existsSync(QC_DB_PATH)) return null;

  try {
    qcDb = new Database(QC_DB_PATH, { readonly: true });
    qcDb.pragma('journal_mode = WAL');
    qcAvailable = true;
    return qcDb;
  } catch {
    qcAvailable = false;
    return null;
  }
}

export function isQcAvailable(): boolean {
  if (qcAvailable) return true;
  getQcDb();
  return qcAvailable;
}

// ----- Types -----

export interface QcDailyFeatures {
  date: string;
  mood: number | null;
  constitution: number | null;
  sleep: number | null;
  steps: number | null;
  comp_time: number | null;
  cell_time: number | null;
  music: number | null;
  alcohol: number | null;
  weight: number | null;
  heart_rate: number | null;
  cals: number | null;
  state_label: string | null;
  apparent_temp: number | null;
  aqi: number | null;
  rescuetime_app_switch_rate: number | null;
  rescuetime_deep_work_minutes: number | null;
  gmail_reply_latency_hours: number | null;
  calendar_obligatory_hours: number | null;
  calendar_restorative_hours: number | null;
  benzo_daily: number | null;
  comm_unique_partners_calls: number | null;
  comm_call_minutes: number | null;
  diary_word_count: number | null;
}

export interface QcLifeChapter {
  name: string;
  start_date: string;
  end_date: string | null; // null = ongoing
  description?: string;
}

export interface QcStateLabel {
  date: string;
  label: 'acute' | 'onset' | 'pre-crash' | 'recovery' | 'stable';
}

export interface QcAnomaly {
  field: string;
  value: number;
  mean30: number;
  std30: number;
  zScore: number;
  direction: 'above' | 'below';
  description: string;
}

export interface QcTriggerWarning {
  pattern: string;
  recurrenceRate: number;
  baseRate: number;
  activePrecursors: string[];
  present: boolean;
}

export interface QcHistoricalAnalog {
  date: string;
  mood: number;
  similarity: number;
  keyDifferences: string[];
}

export interface QcInsightBundle {
  available: boolean;
  stateLabel: QcStateLabel | null;
  currentChapter: QcLifeChapter | null;
  anomalies: QcAnomaly[];
  triggerWarning: QcTriggerWarning | null;
  historicalAnalogs: QcHistoricalAnalog[];
  regressionInsights: string[];
  interventionSuggestion: string | null;
  todayFeatures: QcDailyFeatures | null;
  weekTrend: { dates: string[]; moods: (number | null)[] } | null;
}

// ----- State Label -----

export function getStateLabel(date: string): QcStateLabel | null {
  const db = getQcDb();
  if (!db) return null;

  try {
    const row = db.prepare(
      'SELECT date, state_label FROM daily_features WHERE date = ?'
    ).get(date) as { date: string; state_label: string } | undefined;

    if (!row || !row.state_label) return null;
    return { date: row.date, label: row.state_label as QcStateLabel['label'] };
  } catch {
    return null;
  }
}

export function getRecentStateLabels(limit: number = 14): QcStateLabel[] {
  const db = getQcDb();
  if (!db) return [];

  try {
    return db.prepare(
      'SELECT date, state_label FROM daily_features WHERE state_label IS NOT NULL ORDER BY date DESC LIMIT ?'
    ).all(limit) as QcStateLabel[];
  } catch {
    return [];
  }
}

// ----- Life Chapters -----

export function getCurrentChapter(date: string): QcLifeChapter | null {
  const db = getQcDb();
  if (!db) return null;

  try {
    // Try to find the chapter this date falls in
    const row = db.prepare(
      `SELECT * FROM life_chapters
       WHERE start_date <= ?
       AND (end_date IS NULL OR end_date >= ?)
       ORDER BY start_date DESC LIMIT 1`
    ).get(date, date) as Record<string, string> | undefined;

    if (!row) {
      // Fall back to most recent chapter
      const latest = db.prepare(
        'SELECT * FROM life_chapters ORDER BY start_date DESC LIMIT 1'
      ).get() as Record<string, string> | undefined;
      if (!latest) return null;
      return {
        name: latest.name || latest.chapter_name || '',
        start_date: latest.start_date || '',
        end_date: latest.end_date || null,
        description: latest.description || latest.defining_statistics || '',
      };
    }

    return {
      name: row.name || row.chapter_name || '',
      start_date: row.start_date || '',
      end_date: row.end_date || null,
      description: row.description || row.defining_statistics || '',
    };
  } catch {
    return null;
  }
}

// ----- Daily Features -----

export function getDailyFeatures(date: string): QcDailyFeatures | null {
  const db = getQcDb();
  if (!db) return null;

  try {
    const row = db.prepare('SELECT * FROM daily_features WHERE date = ?').get(date);
    if (!row) return null;
    return row as QcDailyFeatures;
  } catch {
    return null;
  }
}

export function getFeatureRange(startDate: string, endDate: string): QcDailyFeatures[] {
  const db = getQcDb();
  if (!db) return [];

  try {
    return db.prepare(
      'SELECT * FROM daily_features WHERE date >= ? AND date <= ? ORDER BY date'
    ).all(startDate, endDate) as QcDailyFeatures[];
  } catch {
    return [];
  }
}

// ----- Anomaly Detection -----
// Compute z-scores against 30-day baseline, per QC spec

export function detectAnomalies(date: string): QcAnomaly[] {
  const db = getQcDb();
  if (!db) return [];

  const fields: { col: string; label: string; direction: 'high_bad' | 'low_bad' | 'both' }[] = [
    { col: 'mood', label: 'Mood', direction: 'low_bad' },
    { col: 'sleep', label: 'Sleep', direction: 'low_bad' },
    { col: 'steps', label: 'Steps', direction: 'low_bad' },
    { col: 'cell_time', label: 'Phone screen time', direction: 'high_bad' },
    { col: 'alcohol', label: 'Alcohol', direction: 'high_bad' },
    { col: 'rescuetime_app_switch_rate', label: 'App-switching rate', direction: 'high_bad' },
    { col: 'rescuetime_deep_work_minutes', label: 'Deep work minutes', direction: 'low_bad' },
    { col: 'comm_unique_partners_calls', label: 'Unique call partners', direction: 'low_bad' },
  ];

  const anomalies: QcAnomaly[] = [];

  try {
    for (const field of fields) {
      // Get today's value
      const today = db.prepare(
        `SELECT ${field.col} FROM daily_features WHERE date = ?`
      ).get(date) as Record<string, number | null> | undefined;

      const value = today?.[field.col];
      if (value === null || value === undefined) continue;

      // Get 30-day baseline stats
      const stats = db.prepare(
        `SELECT AVG(${field.col}) as mean, COUNT(${field.col}) as n
         FROM daily_features
         WHERE date >= date(?, '-31 days') AND date < ? AND ${field.col} IS NOT NULL`
      ).get(date, date) as { mean: number | null; n: number } | undefined;

      if (!stats || !stats.mean || stats.n < 7) continue;

      // Compute std manually
      const rows = db.prepare(
        `SELECT ${field.col} as val FROM daily_features
         WHERE date >= date(?, '-31 days') AND date < ? AND ${field.col} IS NOT NULL`
      ).all(date, date) as { val: number }[];

      const mean = stats.mean;
      const variance = rows.reduce((sum, r) => sum + (r.val - mean) ** 2, 0) / rows.length;
      const std = Math.sqrt(variance);

      if (std === 0) continue;

      const zScore = (value - mean) / std;

      // Flag if |z| > 1.5 (more sensitive than QC's 2.0 threshold to catch earlier)
      if (Math.abs(zScore) < 1.5) continue;

      const direction: 'above' | 'below' = zScore > 0 ? 'above' : 'below';

      const roundedZ = Math.round(Math.abs(zScore) * 10) / 10;
      const description = `${field.label} is ${roundedZ} SD ${direction} your 30-day baseline`;

      anomalies.push({
        field: field.col,
        value,
        mean30: Math.round(mean * 10) / 10,
        std30: Math.round(std * 10) / 10,
        zScore: roundedZ,
        direction,
        description,
      });
    }

    return anomalies.sort((a, b) => b.zScore - a.zScore);
  } catch {
    return [];
  }
}

// ----- Trigger Map -----
// Check if the validated precursor pattern is present

export function checkTriggerPattern(date: string): QcTriggerWarning | null {
  const db = getQcDb();
  if (!db) return null;

  try {
    // Get the last 3 days of data
    const recent = db.prepare(
      `SELECT date, steps, constitution, cell_time, comp_time, sleep, alcohol, mood, state_label
       FROM daily_features
       WHERE date >= date(?, '-3 days') AND date <= ?
       ORDER BY date`
    ).all(date, date) as Array<Record<string, number | string | null>>;

    if (recent.length < 2) return null;

    // Compute quartile thresholds from full history
    const getQuartile = (col: string, position: 'bottom' | 'top'): number | null => {
      const values = db.prepare(
        `SELECT ${col} as val FROM daily_features WHERE ${col} IS NOT NULL ORDER BY ${col}`
      ).all() as { val: number }[];
      if (values.length < 20) return null;
      const idx = position === 'bottom'
        ? Math.floor(values.length * 0.25)
        : Math.floor(values.length * 0.75);
      return values[idx].val;
    };

    const stepsQ1 = getQuartile('steps', 'bottom');
    const constitutionQ1 = getQuartile('constitution', 'bottom');

    if (stepsQ1 === null || constitutionQ1 === null) return null;

    // Check the validated risk signature: steps AND constitution both in bottom quartile
    const activePrecursors: string[] = [];
    let riskPresent = false;

    for (const day of recent) {
      const steps = typeof day.steps === 'number' ? day.steps : null;
      const constitution = typeof day.constitution === 'number' ? day.constitution : null;
      const lowSteps = steps !== null && steps <= stepsQ1;
      const lowConstitution = constitution !== null && constitution <= constitutionQ1;

      if (lowSteps) activePrecursors.push('Low steps');
      if (lowConstitution) activePrecursors.push('Low constitution');

      if (lowSteps && lowConstitution && String(day.state_label) !== 'acute') {
        riskPresent = true;
      }
    }

    if (!riskPresent && activePrecursors.length === 0) return null;

    // Compute recurrence rate: how often does this pattern precede a crash?
    const riskDays = db.prepare(
      `SELECT COUNT(*) as n FROM daily_features
       WHERE steps <= ? AND constitution <= ? AND state_label != 'acute'`
    ).get(stepsQ1, constitutionQ1) as { n: number };

    const crashAfterRisk = db.prepare(
      `SELECT COUNT(*) as n FROM daily_features d1
       WHERE d1.steps <= ? AND d1.constitution <= ? AND d1.state_label != 'acute'
       AND EXISTS (
         SELECT 1 FROM daily_features d2
         WHERE d2.date > d1.date AND d2.date <= date(d1.date, '+3 days')
         AND d2.state_label = 'acute'
       )`
    ).get(stepsQ1, constitutionQ1) as { n: number };

    const totalDays = db.prepare('SELECT COUNT(*) as n FROM daily_features WHERE mood IS NOT NULL').get() as { n: number };
    const totalAcute = db.prepare("SELECT COUNT(*) as n FROM daily_features WHERE state_label = 'acute'").get() as { n: number };

    const recurrenceRate = riskDays.n > 0 ? crashAfterRisk.n / riskDays.n : 0;
    const baseRate = totalDays.n > 0 ? totalAcute.n / totalDays.n : 0;

    return {
      pattern: 'Steps and constitution both in bottom quartile',
      recurrenceRate: Math.round(recurrenceRate * 100) / 100,
      baseRate: Math.round(baseRate * 100) / 100,
      activePrecursors: [...new Set(activePrecursors)],
      present: riskPresent,
    };
  } catch {
    return null;
  }
}

// ----- Historical Analog -----
// Find days in history most similar to today

export function findHistoricalAnalogs(date: string, limit: number = 3): QcHistoricalAnalog[] {
  const db = getQcDb();
  if (!db) return [];

  try {
    const today = getDailyFeatures(date);
    if (!today) return [];

    // Get comparison fields that are non-null for today
    const compareFields = ['mood', 'constitution', 'sleep', 'steps', 'alcohol', 'music'] as const;
    const todayVals: Record<string, number> = {};
    for (const f of compareFields) {
      const v = today[f as keyof QcDailyFeatures];
      if (typeof v === 'number') todayVals[f] = v;
    }

    if (Object.keys(todayVals).length < 3) return [];

    // Get all historical days with enough data
    const fieldList = Object.keys(todayVals).join(', ');
    const allDays = db.prepare(
      `SELECT date, mood, ${fieldList} FROM daily_features
       WHERE date < ? AND mood IS NOT NULL
       ORDER BY date`
    ).all(date) as Array<Record<string, number | null> & { date: string; mood: number }>;

    if (allDays.length < 30) return [];

    // Compute means and stds for normalization
    const means: Record<string, number> = {};
    const stds: Record<string, number> = {};
    for (const f of Object.keys(todayVals)) {
      const vals = allDays.map(d => d[f]).filter((v): v is number => v !== null);
      if (vals.length === 0) continue;
      means[f] = vals.reduce((a, b) => a + b, 0) / vals.length;
      stds[f] = Math.sqrt(vals.reduce((a, b) => a + (b - means[f]) ** 2, 0) / vals.length) || 1;
    }

    // Compute standardized distance for each historical day
    const scored = allDays.map(day => {
      let sumSq = 0;
      let count = 0;
      const diffs: string[] = [];

      for (const f of Object.keys(todayVals)) {
        const v = day[f];
        if (v === null) continue;
        const normToday = (todayVals[f] - means[f]) / stds[f];
        const normDay = (v - means[f]) / stds[f];
        sumSq += (normToday - normDay) ** 2;
        count++;

        const diff = todayVals[f] - v;
        if (Math.abs(diff) > stds[f] * 0.5) {
          const dir = diff > 0 ? 'higher' : 'lower';
          diffs.push(`${f} was ${Math.abs(Math.round(diff * 10) / 10)} ${dir}`);
        }
      }

      if (count < 3) return null;

      return {
        date: day.date,
        mood: day.mood,
        similarity: Math.round((1 / (1 + Math.sqrt(sumSq / count))) * 100) / 100,
        keyDifferences: diffs.slice(0, 3),
      };
    }).filter((d): d is QcHistoricalAnalog => d !== null);

    return scored.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  } catch {
    return [];
  }
}

// ----- Regression Insights -----
// Simple correlation-based insights from the feature store

export function getRegressionInsights(date: string): string[] {
  const db = getQcDb();
  if (!db) return [];

  try {
    // Get recent window for correlation analysis
    const recent = db.prepare(
      `SELECT mood, sleep, steps, constitution, music, alcohol, cell_time, comp_time,
              calendar_obligatory_hours, rescuetime_deep_work_minutes
       FROM daily_features
       WHERE date >= date(?, '-90 days') AND date <= ? AND mood IS NOT NULL`
    ).all(date, date) as Array<Record<string, number | null>>;

    if (recent.length < 30) return [];

    const insights: string[] = [];
    const predictors: { name: string; label: string; direction: 'positive' | 'negative' }[] = [
      { name: 'sleep', label: 'Sleep', direction: 'positive' },
      { name: 'steps', label: 'Steps', direction: 'positive' },
      { name: 'constitution', label: 'Constitution', direction: 'positive' },
      { name: 'music', label: 'Active music', direction: 'positive' },
      { name: 'alcohol', label: 'Alcohol', direction: 'negative' },
      { name: 'cell_time', label: 'Phone time', direction: 'negative' },
      { name: 'rescuetime_deep_work_minutes', label: 'Deep work', direction: 'positive' },
    ];

    for (const pred of predictors) {
      const pairs = recent
        .filter(r => r.mood !== null && r[pred.name] !== null)
        .map(r => ({ x: r[pred.name] as number, y: r.mood as number }));

      if (pairs.length < 20) continue;

      const r = pearsonR(pairs.map(p => p.x), pairs.map(p => p.y));
      if (Math.abs(r) < 0.15) continue;

      const strength = Math.abs(r) > 0.3 ? 'strong' : 'moderate';
      const dir = r > 0 ? 'positive' : 'negative';
      const expected = pred.direction === 'positive' ? 'positive' : 'negative';

      if (dir === expected) {
        insights.push(`${pred.label} has a ${strength} ${dir} association with mood over the last 90 days (r=${Math.round(r * 100) / 100})`);
      } else {
        insights.push(`${pred.label} shows an unexpected ${dir} association with mood (r=${Math.round(r * 100) / 100})`);
      }
    }

    return insights.sort((a, b) => {
      const rA = parseFloat(a.match(/r=(-?[\d.]+)/)?.[1] || '0');
      const rB = parseFloat(b.match(/r=(-?[\d.]+)/)?.[1] || '0');
      return Math.abs(rB) - Math.abs(rA);
    }).slice(0, 5);
  } catch {
    return [];
  }
}

function pearsonR(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return 0;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : num / denom;
}

// ----- Intervention Suggestions -----

export function getInterventionSuggestion(date: string): string | null {
  const db = getQcDb();
  if (!db) return null;

  try {
    const today = getDailyFeatures(date);
    if (!today) return null;

    const state = today.state_label;

    // Context-aware suggestions based on state and current data
    const suggestions: string[] = [];

    if (state === 'acute' || state === 'onset') {
      suggestions.push(
        'Try 20 minutes outside before noon — movement and light on harder days have preceded recoveries historically',
        'Reach out to one person today, even briefly — social contact on acute days correlates with shorter episodes',
      );
    } else if (state === 'pre-crash') {
      suggestions.push(
        'Protect your sleep tonight — prior-day sleep is the strongest predictor of tomorrow\'s mood in your data',
        'Consider lighter obligations today — high calendar load in the 1-3 days before a drop has recurred in your pattern',
      );
    } else {
      if (today.steps !== null && today.steps < 3000) {
        suggestions.push('Your steps are low today — even a short walk has shown a moderate positive association with mood in your data');
      }
      if (today.music !== null && today.music === 0) {
        suggestions.push('No music logged yet — active music minutes are one of the validated buffers against mood drops');
      }
      if (today.rescuetime_deep_work_minutes !== null && today.rescuetime_deep_work_minutes < 30) {
        suggestions.push('Deep work is below your baseline — a focused 25-minute block could shift the day\'s texture');
      }
      if (suggestions.length === 0) {
        suggestions.push('Stable day — a good window for a creative experiment or a longer-horizon project');
      }
    }

    // Pick one based on day
    const dayIdx = new Date(date).getDate();
    return suggestions[dayIdx % suggestions.length];
  } catch {
    return null;
  }
}

// ----- Mood Trend -----

export function getMoodTrend(date: string, days: number = 14): { dates: string[]; moods: (number | null)[] } | null {
  const db = getQcDb();
  if (!db) return null;

  try {
    const rows = db.prepare(
      `SELECT date, mood FROM daily_features
       WHERE date >= date(?, '-${days} days') AND date <= ?
       ORDER BY date`
    ).all(date, date) as { date: string; mood: number | null }[];

    if (rows.length === 0) return null;
    return {
      dates: rows.map(r => r.date),
      moods: rows.map(r => r.mood),
    };
  } catch {
    return null;
  }
}

// ----- Full Insight Bundle -----
// Collects all QC insights for a given date in one call

export function getInsightBundle(date: string): QcInsightBundle {
  if (!isQcAvailable()) {
    return {
      available: false,
      stateLabel: null,
      currentChapter: null,
      anomalies: [],
      triggerWarning: null,
      historicalAnalogs: [],
      regressionInsights: [],
      interventionSuggestion: null,
      todayFeatures: null,
      weekTrend: null,
    };
  }

  return {
    available: true,
    stateLabel: getStateLabel(date),
    currentChapter: getCurrentChapter(date),
    anomalies: detectAnomalies(date),
    triggerWarning: checkTriggerPattern(date),
    historicalAnalogs: findHistoricalAnalogs(date, 3),
    regressionInsights: getRegressionInsights(date),
    interventionSuggestion: getInterventionSuggestion(date),
    todayFeatures: getDailyFeatures(date),
    weekTrend: getMoodTrend(date, 14),
  };
}
