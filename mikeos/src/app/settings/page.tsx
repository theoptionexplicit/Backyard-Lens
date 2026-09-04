'use client';

import { useEffect, useState, useCallback } from 'react';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [exportInfo, setExportInfo] = useState<{ tables: string[]; formats: string[] } | null>(null);
  const [qcAvailable, setQcAvailable] = useState(false);

  const load = useCallback(async () => {
    try {
      const [settingsRes, exportRes, qcRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/export'),
        fetch('/api/qc?type=status'),
      ]);
      setSettings(await settingsRes.json());
      setExportInfo(await exportRes.json());
      const qcData = await qcRes.json();
      setQcAvailable(qcData.available);
    } catch { /* empty */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaved(false);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function update(key: string, value: string) {
    setSettings(s => ({ ...s, [key]: value }));
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto animate-pulse">
        <div className="h-8 bg-surface rounded w-48 mb-6" />
        {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-surface rounded-lg mb-3" />)}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-20 lg:pb-0">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted mt-1">Your rules, your data</p>
      </header>

      <div className="space-y-6">
        {/* Schedule */}
        <section className="bg-surface border border-border rounded-lg p-5">
          <h2 className="text-sm font-medium text-muted mb-4">Schedule</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted block mb-1">Wake Time</label>
              <input
                type="time"
                value={settings.wakeTime || '07:00'}
                onChange={e => update('wakeTime', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">End Time</label>
              <input
                type="time"
                value={settings.endTime || '22:00'}
                onChange={e => update('endTime', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </section>

        {/* Low Friction Mode */}
        <section className="bg-surface border border-border rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium">Low Friction Mode</h2>
              <p className="text-xs text-muted mt-0.5">Smaller tasks, gentle pacing, more breaks</p>
            </div>
            <button
              onClick={() => update('lowFrictionMode', settings.lowFrictionMode === 'true' ? 'false' : 'true')}
              className={`w-12 h-6 rounded-full relative transition-colors ${
                settings.lowFrictionMode === 'true' ? 'bg-accent' : 'bg-border'
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                settings.lowFrictionMode === 'true' ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </section>

        {/* Relationships */}
        <section className="bg-surface border border-border rounded-lg p-5">
          <h2 className="text-sm font-medium text-muted mb-4">Relationships</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted block mb-1">Partner Name</label>
              <input
                type="text"
                value={settings.veronicaName || ''}
                onChange={e => update('veronicaName', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">Bilingual Messages</p>
                <p className="text-xs text-muted">English + Spanish drafts</p>
              </div>
              <button
                onClick={() => update('bilingual', settings.bilingual === 'true' ? 'false' : 'true')}
                className={`w-12 h-6 rounded-full relative transition-colors ${
                  settings.bilingual === 'true' ? 'bg-accent' : 'bg-border'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  settings.bilingual === 'true' ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </section>

        {/* Health */}
        <section className="bg-surface border border-border rounded-lg p-5">
          <h2 className="text-sm font-medium text-muted mb-4">Health</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted block mb-1">Daily Calorie Target</label>
              <input
                type="number"
                value={settings.dailyCalorieTarget || '2000'}
                onChange={e => update('dailyCalorieTarget', e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm">Meal Logging</p>
              <button
                onClick={() => update('mealLoggingEnabled', settings.mealLoggingEnabled === 'true' ? 'false' : 'true')}
                className={`w-12 h-6 rounded-full relative transition-colors ${
                  settings.mealLoggingEnabled === 'true' ? 'bg-accent' : 'bg-border'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  settings.mealLoggingEnabled === 'true' ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm">Health Check-ins</p>
              <button
                onClick={() => update('healthCheckInsEnabled', settings.healthCheckInsEnabled === 'true' ? 'false' : 'true')}
                className={`w-12 h-6 rounded-full relative transition-colors ${
                  settings.healthCheckInsEnabled === 'true' ? 'bg-accent' : 'bg-border'
                }`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  settings.healthCheckInsEnabled === 'true' ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </section>

        <section className="bg-surface border border-border rounded-lg p-5">
          <h2 className="text-sm font-medium text-muted mb-4">Quantified Claude</h2>
          <div className="flex items-center gap-2 mb-2">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${qcAvailable ? 'bg-success' : 'bg-border'}`} />
            <span className="text-sm">{qcAvailable ? 'Connected' : 'Not connected'}</span>
          </div>
          <p className="text-xs text-muted">
            {qcAvailable
              ? 'Reading from ~/.quantified-claude/feature-store.sqlite'
              : 'Place your feature-store.sqlite at ~/.quantified-claude/'}
          </p>
          <p className="text-xs text-muted mt-2">
            Low-friction mode activates automatically during acute or onset states
          </p>
        </section>

        <section className="bg-surface border border-border rounded-lg p-5">
          <h2 className="text-sm font-medium text-muted mb-4">Export Your Data</h2>
          <p className="text-xs text-muted mb-3">Your data never leaves your machine. Export to standard formats anytime.</p>
          {exportInfo && (
            <div className="space-y-2">
              {exportInfo.tables.map(table => (
                <div key={table} className="flex items-center justify-between py-1">
                  <span className="text-sm">{table.replace('_', ' ')}</span>
                  <div className="flex gap-1">
                    {exportInfo.formats.map(fmt => (
                      <a
                        key={fmt}
                        href={`/api/export?table=${table}&format=${fmt}`}
                        download
                        className="text-xs px-2 py-1 border border-border rounded hover:border-accent text-muted hover:text-accent"
                      >
                        {fmt.toUpperCase()}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Privacy Notice */}
        <section className="bg-surface border border-border rounded-lg p-5">
          <h2 className="text-sm font-medium text-muted mb-2">Privacy</h2>
          <ul className="text-xs text-muted space-y-1">
            <li>All data stored locally in SQLite on your machine</li>
            <li>No cloud sync, no telemetry, no analytics</li>
            <li>No data ever leaves your device</li>
            <li>Export everything anytime in JSON, CSV, or Markdown</li>
            <li>Your data is never used for training</li>
          </ul>
        </section>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            className="px-6 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90"
          >
            Save Settings
          </button>
          {saved && <span className="text-sm text-success">Saved</span>}
        </div>
      </div>
    </div>
  );
}
