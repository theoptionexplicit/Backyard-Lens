'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DashboardData {
  plan: { date: string; blocks: Array<{ id: string; title: string; start: string; end: string; type: string; completed: boolean }> };
  health: { mood: { mood: number; energy: number } | null; sleep: { hours: number; quality: number } | null; calories: { total: number } };
  relationship: Array<{ id: string; action: string; person: string; completed: boolean; messageDraft?: string }>;
  tasks: Array<{ id: string; title: string; priority: string }>;
  prompt: { prompt: string; constraint: string };
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    async function load() {
      try {
        const [planRes, healthRes, relRes, tasksRes, promptRes] = await Promise.all([
          fetch(`/api/planner?date=${today}`),
          fetch(`/api/health?date=${today}`),
          fetch(`/api/relationships?date=${today}`),
          fetch('/api/ingest?type=tasks'),
          fetch('/api/creative?prompt=1'),
        ]);

        const [plan, health, relationship, tasks, prompt] = await Promise.all([
          planRes.json(),
          healthRes.json(),
          relRes.json(),
          tasksRes.json(),
          promptRes.json(),
        ]);

        setData({ plan, health, relationship, tasks, prompt });
      } catch {
        // Silently handle — data will show empty states
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
        <h1 className="text-2xl font-semibold">{greeting}, Mike</h1>
        <p className="text-muted text-sm mt-1">{formatDate(today)}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Today's Plan */}
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

        {/* Quick Health Check */}
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

        {/* Loving Action */}
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

        {/* Creative Prompt */}
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

        {/* Tasks */}
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
