'use client';

import { useEffect, useState, useCallback } from 'react';

interface AutomationTask {
  id: string;
  title: string;
  type: string;
  description: string;
  lastRun?: string;
  enabled: boolean;
}

export default function AutomationPage() {
  const [tasks, setTasks] = useState<AutomationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'custom', description: '' });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/automation');
      setTasks(await res.json());
    } catch { /* empty */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runTask(id: string) {
    setRunning(id);
    setResult(null);
    try {
      const res = await fetch('/api/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run', id }),
      });
      const data = await res.json();
      setResult(data);
      load();
    } catch {
      setResult({ success: false, message: 'Failed to run' });
    } finally {
      setRunning(null);
    }
  }

  async function toggleTask(id: string) {
    await fetch('/api/automation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', id }),
    });
    load();
  }

  async function deleteTask(id: string) {
    await fetch(`/api/automation?id=${id}`, { method: 'DELETE' });
    load();
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    await fetch('/api/automation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ title: '', type: 'custom', description: '' });
    setShowForm(false);
    load();
  }

  const typeColors: Record<string, string> = {
    file_cleanup: 'bg-accent-light text-accent',
    receipt: 'bg-warning/10 text-warning',
    invoice: 'bg-warning/10 text-warning',
    browser: 'bg-danger/10 text-danger',
    custom: 'bg-surface text-muted',
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse">
        <div className="h-8 bg-surface rounded w-48 mb-6" />
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-surface rounded-lg mb-3" />)}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20 lg:pb-0">
      <header className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">Automations</h1>
          <p className="text-sm text-muted mt-1">Do it for me</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm px-4 py-2 bg-accent text-white rounded-lg hover:opacity-90"
        >
          {showForm ? 'Cancel' : 'New Automation'}
        </button>
      </header>

      {result && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${result.success ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
          {result.message}
        </div>
      )}

      {showForm && (
        <form onSubmit={createTask} className="bg-surface border border-border rounded-lg p-5 mb-6 space-y-3">
          <input
            type="text"
            placeholder="Automation name..."
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
          />
          <select
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
          >
            <option value="file_cleanup">File Cleanup</option>
            <option value="receipt">Receipt Organizer</option>
            <option value="invoice">Invoice</option>
            <option value="browser">Browser Hygiene</option>
            <option value="custom">Custom</option>
          </select>
          <textarea
            placeholder="What does this do?"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent resize-none"
          />
          <button type="submit" className="text-sm px-4 py-2 bg-accent text-white rounded-lg hover:opacity-90">
            Create
          </button>
        </form>
      )}

      <div className="space-y-3">
        {tasks.map(task => (
          <div
            key={task.id}
            className={`bg-surface border border-border rounded-lg p-4 ${!task.enabled ? 'opacity-50' : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-medium">{task.title}</h3>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${typeColors[task.type] || typeColors.custom}`}>
                    {task.type.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-muted">{task.description}</p>
                {task.lastRun && (
                  <p className="text-xs text-muted mt-1">Last run: {new Date(task.lastRun).toLocaleString()}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => runTask(task.id)}
                  disabled={running === task.id || !task.enabled}
                  className="text-xs px-3 py-1.5 bg-accent text-white rounded hover:opacity-90 disabled:opacity-50"
                >
                  {running === task.id ? 'Running...' : 'Run'}
                </button>
                <button
                  onClick={() => toggleTask(task.id)}
                  className={`text-xs px-3 py-1.5 rounded border ${task.enabled ? 'border-border text-muted' : 'border-success text-success'}`}
                >
                  {task.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="text-xs px-2 py-1.5 text-danger hover:bg-danger/10 rounded"
                >
                  Del
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {tasks.length === 0 && (
        <div className="text-center py-12 text-muted text-sm">
          No automations yet. Create one to get started.
        </div>
      )}
    </div>
  );
}
