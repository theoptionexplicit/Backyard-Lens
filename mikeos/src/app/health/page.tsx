'use client';

import { useEffect, useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MoodEntry {
  id: string;
  date: string;
  mood: number;
  energy: number;
  anxiety: number;
  notes?: string;
  createdAt: string;
}

interface SleepEntry {
  id: string;
  date: string;
  hours: number;
  quality: number;
  bedtime?: string;
  wakeTime?: string;
  notes?: string;
  createdAt: string;
}

interface HealthEntry {
  id: string;
  date: string;
  type: 'meal' | 'mood' | 'sleep' | 'med' | 'symptom' | 'weight';
  value: string;
  calories?: number;
  notes?: string;
  createdAt: string;
}

interface QcInsightBundle {
  available: boolean;
  anomalies: Array<{ field: string; value: number; mean30: number; std30: number; zScore: number; direction: 'above' | 'below'; description: string }>;
  regressionInsights: string[];
  todayFeatures: { mood: number | null; steps: number | null; sleep: number | null; constitution: number | null; heart_rate: number | null; weight: number | null; [key: string]: any } | null;
  weekTrend: { dates: string[]; moods: (number | null)[] } | null;
  stateLabel: { date: string; label: string } | null;
}

interface WeeklyTrend {
  weekStart: string;
  avgMood: number;
  avgEnergy: number;
  avgSleep: number;
  totalCalories: number;
  avgCalories: number;
  symptomsCount: number;
  tasksCompleted: number;
  correlations: string[];
}

interface DailyData {
  date: string;
  entries: HealthEntry[];
  mood: MoodEntry | null;
  sleep: SleepEntry | null;
  calories: { total: number; entries: HealthEntry[] };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/** Monday of the current week in YYYY-MM-DD */
function currentWeekStart(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return mon.toISOString().split('T')[0];
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HealthPage() {
  const today = todayStr();

  // --- Data state ---
  const [daily, setDaily] = useState<DailyData | null>(null);
  const [trends, setTrends] = useState<WeeklyTrend | null>(null);
  const [calorieTarget, setCalorieTarget] = useState<number>(2000);
  const [qc, setQc] = useState<QcInsightBundle | null>(null);
  const [loading, setLoading] = useState(true);

  // --- Mood / Energy / Anxiety ---
  const [mood, setMood] = useState(5);
  const [energy, setEnergy] = useState(5);
  const [anxiety, setAnxiety] = useState(3);
  const [moodNotes, setMoodNotes] = useState('');
  const [savingMood, setSavingMood] = useState(false);
  const [moodSaved, setMoodSaved] = useState(false);

  // --- Sleep ---
  const [sleepHours, setSleepHours] = useState('7');
  const [sleepQuality, setSleepQuality] = useState(6);
  const [savingSleep, setSavingSleep] = useState(false);
  const [sleepSaved, setSleepSaved] = useState(false);

  // --- Meal ---
  const [mealPhrase, setMealPhrase] = useState('');
  const [savingMeal, setSavingMeal] = useState(false);

  // --- Symptom ---
  const [symptomText, setSymptomText] = useState('');
  const [savingSymptom, setSavingSymptom] = useState(false);

  // --- Med ---
  const [medText, setMedText] = useState('');
  const [savingMed, setSavingMed] = useState(false);

  // --- Active section (for mobile accordion, all open on desktop) ---
  const [openSection, setOpenSection] = useState<string | null>('mood');

  // -------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------

  const fetchDaily = useCallback(async () => {
    try {
      const res = await fetch(`/api/health?date=${today}`);
      const data: DailyData = await res.json();
      setDaily(data);

      // Pre-fill sliders if there is already a mood entry
      if (data.mood) {
        setMood(data.mood.mood);
        setEnergy(data.mood.energy);
        setAnxiety(data.mood.anxiety);
        setMoodNotes(data.mood.notes || '');
        setMoodSaved(true);
      }
      if (data.sleep) {
        setSleepHours(String(data.sleep.hours));
        setSleepQuality(data.sleep.quality);
        setSleepSaved(true);
      }
    } catch {
      // Silently handle
    }
  }, [today]);

  const fetchTrends = useCallback(async () => {
    try {
      const ws = currentWeekStart();
      const res = await fetch(`/api/health?type=trends&weekStart=${ws}`);
      setTrends(await res.json());
    } catch {
      // Silently handle
    }
  }, []);

  const fetchQc = useCallback(async () => {
    try {
      const res = await fetch(`/api/qc?date=${today}`);
      const data: QcInsightBundle = await res.json();
      if (data.available) {
        setQc(data);
      }
    } catch {
    }
  }, [today]);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const s = await res.json();
      if (s.dailyCalorieTarget) {
        setCalorieTarget(Number(s.dailyCalorieTarget));
      }
    } catch {
      // Silently handle
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchDaily(), fetchTrends(), fetchSettings(), fetchQc()]).finally(() =>
      setLoading(false),
    );
  }, [fetchDaily, fetchTrends, fetchSettings, fetchQc]);

  // -------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------

  async function handleSaveMood() {
    setSavingMood(true);
    try {
      await fetch('/api/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'mood',
          mood,
          energy,
          anxiety,
          notes: moodNotes || undefined,
          date: today,
        }),
      });
      setMoodSaved(true);
      await fetchDaily();
    } catch {
      // Silently handle
    } finally {
      setSavingMood(false);
    }
  }

  async function handleSaveSleep() {
    setSavingSleep(true);
    try {
      await fetch('/api/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sleep',
          hours: parseFloat(sleepHours) || 0,
          quality: sleepQuality,
          date: today,
        }),
      });
      setSleepSaved(true);
      await fetchDaily();
    } catch {
      // Silently handle
    } finally {
      setSavingSleep(false);
    }
  }

  async function handleLogMeal(e: React.FormEvent) {
    e.preventDefault();
    if (!mealPhrase.trim()) return;
    setSavingMeal(true);
    try {
      await fetch('/api/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'meal', value: mealPhrase.trim(), date: today }),
      });
      setMealPhrase('');
      await fetchDaily();
    } catch {
      // Silently handle
    } finally {
      setSavingMeal(false);
    }
  }

  async function handleLogSymptom(e: React.FormEvent) {
    e.preventDefault();
    if (!symptomText.trim()) return;
    setSavingSymptom(true);
    try {
      await fetch('/api/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'symptom', value: symptomText.trim(), date: today }),
      });
      setSymptomText('');
      await fetchDaily();
    } catch {
      // Silently handle
    } finally {
      setSavingSymptom(false);
    }
  }

  async function handleLogMed(e: React.FormEvent) {
    e.preventDefault();
    if (!medText.trim()) return;
    setSavingMed(true);
    try {
      await fetch('/api/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'med', value: medText.trim(), date: today }),
      });
      setMedText('');
      await fetchDaily();
    } catch {
      // Silently handle
    } finally {
      setSavingMed(false);
    }
  }

  // -------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------

  const mealEntries = daily?.calories?.entries || [];
  const calTotal = daily?.calories?.total || 0;
  const calPct = calorieTarget > 0 ? Math.min(100, Math.round((calTotal / calorieTarget) * 100)) : 0;

  const symptomEntries = (daily?.entries || []).filter(e => e.type === 'symptom');
  const medEntries = (daily?.entries || []).filter(e => e.type === 'med');
  const allEntries = daily?.entries || [];

  // -------------------------------------------------------------------
  // Toggle helper for mobile accordion
  // -------------------------------------------------------------------

  function toggle(section: string) {
    setOpenSection(prev => (prev === section ? null : section));
  }

  // -------------------------------------------------------------------
  // Loading skeleton
  // -------------------------------------------------------------------

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse pb-20 lg:pb-0">
        <div className="h-8 bg-surface rounded w-48 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-32 bg-surface rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  return (
    <div className="max-w-4xl mx-auto pb-20 lg:pb-0">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Health</h1>
        <p className="text-muted text-sm mt-1">Quick check-ins, meals, symptoms &amp; trends</p>
      </header>

      <div className="space-y-4">
        {/* ================================================================
            MOOD / ENERGY / ANXIETY CHECK-IN
            ================================================================ */}
        <Section
          title="Mood / Energy / Anxiety"
          badge={moodSaved ? 'logged' : undefined}
          open={openSection === 'mood'}
          onToggle={() => toggle('mood')}
        >
          <div className="space-y-4">
            {/* Mood slider */}
            <SliderRow
              label="Mood"
              value={mood}
              onChange={setMood}
              lowLabel="low"
              highLabel="great"
            />

            {/* Energy slider */}
            <SliderRow
              label="Energy"
              value={energy}
              onChange={setEnergy}
              lowLabel="drained"
              highLabel="wired"
            />

            {/* Anxiety slider */}
            <SliderRow
              label="Anxiety"
              value={anxiety}
              onChange={setAnxiety}
              lowLabel="calm"
              highLabel="high"
            />

            {/* Notes */}
            <div>
              <label className="block text-xs text-muted mb-1">Notes (optional)</label>
              <input
                type="text"
                value={moodNotes}
                onChange={e => setMoodNotes(e.target.value)}
                placeholder="Anything worth noting..."
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:border-accent placeholder:text-muted"
              />
            </div>

            <button
              onClick={handleSaveMood}
              disabled={savingMood}
              className="w-full py-2 px-4 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {savingMood ? 'Saving...' : moodSaved ? 'Update Check-in' : 'Save Check-in'}
            </button>
          </div>
        </Section>

        {/* ================================================================
            SLEEP
            ================================================================ */}
        <Section
          title="Sleep"
          badge={sleepSaved ? 'logged' : undefined}
          open={openSection === 'sleep'}
          onToggle={() => toggle('sleep')}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Hours */}
              <div>
                <label className="block text-xs text-muted mb-1">Hours slept</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={sleepHours}
                  onChange={e => setSleepHours(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:border-accent placeholder:text-muted"
                />
              </div>

              {/* Quality */}
              <div>
                <label className="block text-xs text-muted mb-1">
                  Quality <span className="text-foreground font-medium">{sleepQuality}/10</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={sleepQuality}
                  onChange={e => setSleepQuality(Number(e.target.value))}
                  className="w-full accent-accent"
                />
              </div>
            </div>

            <button
              onClick={handleSaveSleep}
              disabled={savingSleep}
              className="w-full py-2 px-4 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {savingSleep ? 'Saving...' : sleepSaved ? 'Update Sleep' : 'Save Sleep'}
            </button>
          </div>
        </Section>

        {qc?.todayFeatures && (
          (() => {
            const vitals: { label: string; value: string }[] = [];
            if (qc.todayFeatures.steps != null) vitals.push({ label: 'Steps', value: String(qc.todayFeatures.steps) });
            if (qc.todayFeatures.constitution != null) vitals.push({ label: 'Constitution', value: `${qc.todayFeatures.constitution}/10` });
            if (qc.todayFeatures.heart_rate != null) vitals.push({ label: 'Heart Rate', value: `${qc.todayFeatures.heart_rate} bpm` });
            if (qc.todayFeatures.weight != null) vitals.push({ label: 'Weight', value: `${qc.todayFeatures.weight} lbs` });
            if (vitals.length === 0) return null;
            return (
              <Section
                title="QC Vitals"
                open={openSection === 'qc-vitals'}
                onToggle={() => toggle('qc-vitals')}
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {vitals.map(v => (
                    <StatCard key={v.label} label={v.label} value={v.value} />
                  ))}
                </div>
              </Section>
            );
          })()
        )}

        {/* ================================================================
            MEALS
            ================================================================ */}
        <Section
          title="Meals"
          badge={mealEntries.length > 0 ? `${calTotal} cal` : undefined}
          open={openSection === 'meals'}
          onToggle={() => toggle('meals')}
        >
          <div className="space-y-4">
            {/* Calorie progress */}
            <div>
              <div className="flex items-center justify-between text-xs text-muted mb-1">
                <span>{calTotal} / {calorieTarget} cal</span>
                <span>{calPct}%</span>
              </div>
              <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    calPct >= 100 ? 'bg-warning' : 'bg-accent'
                  }`}
                  style={{ width: `${calPct}%` }}
                />
              </div>
              <p className="text-xs text-muted mt-1">
                Daily target: {calorieTarget} cal (from settings)
              </p>
            </div>

            {/* Meal input */}
            <form onSubmit={handleLogMeal} className="flex gap-2">
              <input
                type="text"
                value={mealPhrase}
                onChange={e => setMealPhrase(e.target.value)}
                placeholder='e.g. "eggs and toast ~350cal" or "banana"'
                className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:border-accent placeholder:text-muted"
              />
              <button
                type="submit"
                disabled={savingMeal || !mealPhrase.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                {savingMeal ? '...' : 'Log'}
              </button>
            </form>

            {/* Today's meals */}
            {mealEntries.length > 0 && (
              <div className="divide-y divide-border">
                {mealEntries.map(entry => (
                  <div key={entry.id} className="py-2 flex items-center justify-between">
                    <span className="text-sm">{entry.value}</span>
                    <span className="text-xs text-muted font-mono">
                      {entry.calories ? `${entry.calories} cal` : '-- cal'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* ================================================================
            SYMPTOMS & MEDS
            ================================================================ */}
        <Section
          title="Symptoms &amp; Meds"
          badge={
            symptomEntries.length + medEntries.length > 0
              ? `${symptomEntries.length + medEntries.length} logged`
              : undefined
          }
          open={openSection === 'symptoms'}
          onToggle={() => toggle('symptoms')}
        >
          <div className="space-y-4">
            {/* Symptom input */}
            <form onSubmit={handleLogSymptom} className="space-y-1">
              <label className="block text-xs text-muted">Log a symptom</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={symptomText}
                  onChange={e => setSymptomText(e.target.value)}
                  placeholder="reflux, headache, fatigue..."
                  className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:border-accent placeholder:text-muted"
                />
                <button
                  type="submit"
                  disabled={savingSymptom || !symptomText.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-danger/10 text-danger hover:bg-danger/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {savingSymptom ? '...' : 'Log'}
                </button>
              </div>
            </form>

            {/* Med input */}
            <form onSubmit={handleLogMed} className="space-y-1">
              <label className="block text-xs text-muted">Log a medication</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={medText}
                  onChange={e => setMedText(e.target.value)}
                  placeholder="omeprazole 20mg, ibuprofen..."
                  className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:border-accent placeholder:text-muted"
                />
                <button
                  type="submit"
                  disabled={savingMed || !medText.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-accent-light text-accent hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {savingMed ? '...' : 'Log'}
                </button>
              </div>
            </form>

            {/* Today's symptoms */}
            {symptomEntries.length > 0 && (
              <div>
                <p className="text-xs text-muted mb-1">Symptoms today</p>
                <div className="flex flex-wrap gap-1.5">
                  {symptomEntries.map(e => (
                    <span
                      key={e.id}
                      className="inline-block text-xs px-2 py-1 rounded-full bg-danger/10 text-danger"
                    >
                      {e.value}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Today's meds */}
            {medEntries.length > 0 && (
              <div>
                <p className="text-xs text-muted mb-1">Meds today</p>
                <div className="flex flex-wrap gap-1.5">
                  {medEntries.map(e => (
                    <span
                      key={e.id}
                      className="inline-block text-xs px-2 py-1 rounded-full bg-accent-light text-accent"
                    >
                      {e.value}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* ================================================================
            WEEKLY TRENDS
            ================================================================ */}
        <Section
          title="Weekly Trends"
          open={openSection === 'trends'}
          onToggle={() => toggle('trends')}
        >
          {trends ? (
            <div className="space-y-4">
              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Avg Mood" value={trends.avgMood ? `${trends.avgMood}/10` : '--'} />
                <StatCard label="Avg Energy" value={trends.avgEnergy ? `${trends.avgEnergy}/10` : '--'} />
                <StatCard label="Avg Sleep" value={trends.avgSleep ? `${trends.avgSleep}h` : '--'} />
                <StatCard label="Total Cal" value={trends.totalCalories ? String(trends.totalCalories) : '--'} />
                <StatCard label="Avg Cal/day" value={trends.avgCalories ? String(trends.avgCalories) : '--'} />
                <StatCard label="Symptoms" value={String(trends.symptomsCount)} />
              </div>

              <div className="flex items-center justify-between bg-accent-light/30 rounded-lg p-3">
                <span className="text-xs text-muted">Tasks completed</span>
                <span className="text-sm font-semibold">{trends.tasksCompleted}</span>
              </div>

              {/* Correlations / Insights */}
              {trends.correlations.length > 0 && (
                <div>
                  <p className="text-xs text-muted mb-2">Insights</p>
                  <ul className="space-y-1.5">
                    {trends.correlations.map((c, i) => (
                      <li
                        key={i}
                        className="text-sm pl-3 border-l-2 border-accent py-0.5"
                      >
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {trends.correlations.length === 0 && (
                <p className="text-sm text-muted">
                  Not enough data yet for insights. Keep logging!
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">No trend data available.</p>
          )}
        </Section>

        {qc && qc.anomalies.length > 0 && (
          <Section
            title="Anomaly Flags"
            badge={`${qc.anomalies.length}`}
            open={openSection === 'anomalies'}
            onToggle={() => toggle('anomalies')}
          >
            <ul className="space-y-1.5">
              {qc.anomalies.map((a, i) => (
                <li
                  key={i}
                  className={`text-sm ${a.direction === 'above' ? 'text-warning' : 'text-danger'}`}
                >
                  {a.description}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {qc && qc.regressionInsights.length > 0 && (
          <Section
            title="Regression Insights"
            open={openSection === 'regression'}
            onToggle={() => toggle('regression')}
          >
            <ul className="space-y-1.5">
              {qc.regressionInsights.map((r, i) => (
                <li
                  key={i}
                  className="text-sm pl-3 border-l-2 border-accent py-0.5"
                >
                  {r}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ================================================================
            TODAY'S ENTRIES (ALL)
            ================================================================ */}
        <Section
          title="Today&rsquo;s Entries"
          badge={allEntries.length > 0 ? String(allEntries.length) : undefined}
          open={openSection === 'entries'}
          onToggle={() => toggle('entries')}
        >
          {allEntries.length > 0 ? (
            <div className="divide-y divide-border">
              {allEntries.map(entry => (
                <div key={entry.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <TypeBadge type={entry.type} />
                    <span className="text-sm truncate">{entry.value}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {entry.calories != null && (
                      <span className="text-xs text-muted font-mono">{entry.calories} cal</span>
                    )}
                    <span className="text-xs text-muted">{formatTime(entry.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No entries yet today. Start with a quick check-in above.</p>
          )}

          {/* Also show mood/sleep summary inline */}
          {(daily?.mood || daily?.sleep) && (
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-3">
              {daily?.mood && (
                <div className="bg-accent-light/30 rounded-lg p-3">
                  <p className="text-xs text-muted mb-1">Mood check-in</p>
                  <p className="text-sm">
                    Mood {daily.mood.mood} / Energy {daily.mood.energy} / Anxiety {daily.mood.anxiety}
                  </p>
                  {daily.mood.notes && (
                    <p className="text-xs text-muted mt-1 italic">{daily.mood.notes}</p>
                  )}
                </div>
              )}
              {daily?.sleep && (
                <div className="bg-accent-light/30 rounded-lg p-3">
                  <p className="text-xs text-muted mb-1">Sleep</p>
                  <p className="text-sm">
                    {daily.sleep.hours}h &middot; quality {daily.sleep.quality}/10
                  </p>
                </div>
              )}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Collapsible section card */
function Section({
  title,
  badge,
  open,
  onToggle,
  children,
}: {
  title: string;
  badge?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-sm font-medium hover:bg-accent-light/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span dangerouslySetInnerHTML={{ __html: title }} />
          {badge && (
            <span className="text-xs font-normal px-1.5 py-0.5 rounded-full bg-success/10 text-success">
              {badge}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && <div className="p-4 pt-0">{children}</div>}
    </div>
  );
}

/** A single slider row: label, range 1-10, numeric display */
function SliderRow({
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-muted">{label}</label>
        <span className="text-sm font-semibold">{value}/10</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
      <div className="flex justify-between text-[10px] text-muted -mt-0.5">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

/** Small stat card for weekly trends */
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background border border-border rounded-lg p-3 text-center">
      <p className="text-xs text-muted mb-0.5">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

/** Colored badge for entry types */
function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    meal: 'bg-accent-light text-accent',
    symptom: 'bg-danger/10 text-danger',
    med: 'bg-warning/10 text-warning',
    mood: 'bg-success/10 text-success',
    sleep: 'bg-accent/10 text-accent',
    weight: 'bg-border text-muted',
  };

  return (
    <span className={`text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded ${styles[type] || styles.weight}`}>
      {type}
    </span>
  );
}
