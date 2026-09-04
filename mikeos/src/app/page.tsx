'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface QcInsightBundle {
  available: boolean;
  stateLabel: { date: string; label: 'acute' | 'onset' | 'pre-crash' | 'recovery' | 'stable' } | null;
  currentChapter: { name: string; start_date: string; end_date: string | null; description?: string } | null;
  anomalies: Array<{ field: string; value: number; mean30: number; std30: number; zScore: number; direction: 'above' | 'below'; description: string }>;
  triggerWarning: { pattern: string; recurrenceRate: number; baseRate: number; activePrecursors: string[]; present: boolean } | null;
  historicalAnalogs: Array<{ date: string; mood: number; similarity: number; keyDifferences: string[] }>;
  regressionInsights: string[];
  interventionSuggestion: string | null;
  todayFeatures: { mood: number | null; steps: number | null; sleep: number | null; constitution: number | null; [key: string]: any } | null;
  weekTrend: { dates: string[]; moods: (number | null)[] } | null;
}

interface DashboardData {
  plan: { date: string; blocks: Array<{ id: string; title: string; start: string; end: string; type: string; completed: boolean }> };
  health: { mood: { mood: number; energy: number } | null; sleep: { hours: number; quality: number } | null; calories: { total: number } };
  relationship: Array<{ id: string; action: string; person: string; completed: boolean; messageDraft?: string }>;
  tasks: Array<{ id: string; title: string; priority: string }>;
  prompt: { prompt: string; constraint: string };
  qc: QcInsightBundle | null;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    async function load() {
      try {
        const [planRes, healthRes, relRes, tasksRes, promptRes, qcRes] = await Promise.all([
          fetch(`/api/planner?date=${today}`),
          fetch(`/api/health?date=${today}`),
          fetch(`/api/relationships?date=${today}`),
          fetch('/api/ingest?type=tasks'),
          fetch('/api/creative?prompt=1'),
          fetch(`/api/qc?date=${today}`),
        ]);

        const [plan, health, relationship, tasks, prompt, qcRaw] = await Promise.all([
          planRes.json(),
          healthRes.json(),
          relRes.json(),
          tasksRes.json(),
          promptRes.json(),
          qcRes.ok ? qcRes.json() : null,
        ]);

        const qc: QcInsightBundle | null = qcRaw?.available ? qcRaw : null;
        setData({ plan, health, relationship, tasks, prompt, qc });
      } catch {
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [today]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse">
        <div className="h-8 bg-surface rounded w-48 mb-6" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-40 bg-surface rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const greeting = getGreeting();
  const upcomingBlocks = data?.plan?.blocks?.filter(b => !b.completed).slice(0, 3) || [];
  const pendingTasks = data?.tasks?.slice(0, 5) || [];
  const todayAction = data?.relationship?.[0];

  return (
    <div className="max-w-4xl mx-auto pb-20 lg:pb-0">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{greeting}, Mike</h1>
          {data?.qc?.stateLabel && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              data.qc.stateLabel.label === 'acute' ? 'bg-danger/10 text-danger' :
              data.qc.stateLabel.label === 'onset' ? 'bg-warning/10 text-warning' :
              data.qc.stateLabel.label === 'pre-crash' ? 'bg-warning/10 text-warning' :
              data.qc.stateLabel.label === 'recovery' ? 'bg-success/10 text-success' :
              'bg-muted/10 text-muted'
            }`}>
              {data.qc.stateLabel.label}
            </span>
          )}
        </div>
        <p className="text-muted text-sm mt-1">{formatDate(today)}</p>
        {data?.qc?.currentChapter && (
          <p className="text-muted text-xs mt-0.5">{data.qc.currentChapter.name}</p>
        )}
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/planner" className="block">
          <div className="bg-surface border border-border rounded-lg p-5 hover:border-accent/30 transition-colors">
            <h2 className="text-sm font-medium text-muted mb-3">Today&apos;s Plan</h2>
            {upcomingBlocks.length > 0 ? (
              <div className="space-y-2">
                {upcomingBlocks.map(block => (
                  <div key={block.id} className="flex items-center gap-3">
                    <span className="text-xs text-muted font-mono w-12">{block.start}</span>
                    <span className={`text-sm ${block.type === 'fixed' ? 'font-medium' : ''}`}>
                      {block.title}
                    </span>
                  </div>
                ))}
                {data?.plan?.blocks && data.plan.blocks.length > 3 && (
                  <p className="text-xs text-muted">+{data.plan.blocks.length - 3} more blocks</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">No plan yet. Tap to generate.</p>
            )}
          </div>
        </Link>

        <Link href="/health" className="block">
          <div className="bg-surface border border-border rounded-lg p-5 hover:border-accent/30 transition-colors">
            <h2 className="text-sm font-medium text-muted mb-3">Health Today</h2>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted">Mood</p>
                <p className="text-lg font-semibold">
                  {data?.health?.mood ? `${data.health.mood.mood}/10` : '--'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Sleep</p>
                <p className="text-lg font-semibold">
                  {data?.health?.sleep ? `${data.health.sleep.hours}h` : '--'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Calories</p>
                <p className="text-lg font-semibold">
                  {data?.health?.calories?.total || 0}
                </p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/relationships" className="block">
          <div className="bg-surface border border-border rounded-lg p-5 hover:border-accent/30 transition-colors">
            <h2 className="text-sm font-medium text-muted mb-3">
              Today for {todayAction?.person || 'Veronica'}
            </h2>
            {todayAction ? (
              <div>
                <p className={`text-sm ${todayAction.completed ? 'line-through text-muted' : ''}`}>
                  {todayAction.action}
                </p>
                {todayAction.messageDraft && (
                  <p className="text-xs text-muted mt-2 italic">&ldquo;{todayAction.messageDraft}&rdquo;</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">Generate today&apos;s action</p>
            )}
          </div>
        </Link>

        <Link href="/studio" className="block">
          <div className="bg-surface border border-border rounded-lg p-5 hover:border-accent/30 transition-colors">
            <h2 className="text-sm font-medium text-muted mb-3">Creative Spark</h2>
            {data?.prompt ? (
              <div>
                <p className="text-sm">{data.prompt.prompt}</p>
                <p className="text-xs text-muted mt-2">{data.prompt.constraint}</p>
              </div>
            ) : (
              <p className="text-sm text-muted">Get a prompt</p>
            )}
          </div>
        </Link>

        {data?.qc?.weekTrend && data.qc.weekTrend.moods.some(m => m !== null) && (
          <div className="bg-surface border border-border rounded-lg p-5">
            <h2 className="text-sm font-medium text-muted mb-3">Mood Trend</h2>
            <div className="flex items-end gap-1 h-12">
              {data.qc.weekTrend.moods.map((m, i) => (
                <div key={i} className="flex flex-col items-center flex-1 gap-1">
                  {m !== null ? (
                    <>
                      <div
                        className="w-full bg-accent/30 rounded-sm"
                        style={{ height: `${(m / 10) * 100}%` }}
                      />
                      <span className="text-xs text-muted">{m}</span>
                    </>
                  ) : (
                    <span className="text-xs text-muted">--</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {data?.qc?.interventionSuggestion && (
          <div className="bg-surface border border-border rounded-lg p-5">
            <h2 className="text-sm font-medium text-muted mb-3">Suggested Intervention</h2>
            <p className="text-sm">{data.qc.interventionSuggestion}</p>
          </div>
        )}

        {data?.qc?.anomalies && data.qc.anomalies.length > 0 && (
          <div className="bg-surface border border-border rounded-lg p-5">
            <h2 className="text-sm font-medium text-muted mb-3">Anomalies</h2>
            <div className="space-y-2">
              {data.qc.anomalies.map((a, i) => (
                <p key={i} className="text-sm">{a.description}</p>
              ))}
            </div>
          </div>
        )}

        {data?.qc?.triggerWarning?.present && (
          <div className="bg-surface border border-border rounded-lg p-5">
            <h2 className="text-sm font-medium text-muted mb-3">Trigger Pattern</h2>
            <p className="text-sm mb-2">{data.qc.triggerWarning.pattern}</p>
            {data.qc.triggerWarning.activePrecursors.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.qc.triggerWarning.activePrecursors.map((p, i) => (
                  <span key={i} className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full">{p}</span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="md:col-span-2">
          <div className="bg-surface border border-border rounded-lg p-5">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-medium text-muted">Open Tasks</h2>
              <span className="text-xs text-muted">{pendingTasks.length} tasks</span>
            </div>
            {pendingTasks.length > 0 ? (
              <div className="space-y-2">
                {pendingTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                      task.priority === 'high' ? 'bg-danger/10 text-danger' :
                      task.priority === 'medium' ? 'bg-warning/10 text-warning' :
                      'bg-accent-light text-accent'
                    }`}>
                      {task.priority[0]}
                    </span>
                    <span className="text-sm">{task.title}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No open tasks. Nice.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
