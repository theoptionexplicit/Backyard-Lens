'use client';

import { useEffect, useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RelationshipAction {
  id: string;
  date: string;
  person: string;
  action: string;
  messageDraft?: string;
  messageDraftEs?: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RelationshipsPage() {
  const today = todayStr();

  // --- Today's action state ---
  const [todayActions, setTodayActions] = useState<RelationshipAction[]>([]);
  const [recentActions, setRecentActions] = useState<RelationshipAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingDoneId, setMarkingDoneId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // --- Quick action state ---
  const [quickPerson, setQuickPerson] = useState('');
  const [quickGenerating, setQuickGenerating] = useState(false);

  // --- Clipboard feedback ---
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // -------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------

  const fetchTodayActions = useCallback(async () => {
    try {
      const res = await fetch(`/api/relationships?date=${today}`);
      const data: RelationshipAction[] = await res.json();
      setTodayActions(data);
    } catch {
      // Silently handle
    }
  }, [today]);

  const fetchRecentActions = useCallback(async () => {
    try {
      const res = await fetch('/api/relationships?recent=14');
      const data: RelationshipAction[] = await res.json();
      setRecentActions(data);
    } catch {
      // Silently handle
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchTodayActions(), fetchRecentActions()]).finally(() =>
      setLoading(false),
    );
  }, [fetchTodayActions, fetchRecentActions]);

  // -------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------

  async function handleMarkDone(id: string) {
    setMarkingDoneId(id);
    try {
      await fetch('/api/relationships', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      await Promise.all([fetchTodayActions(), fetchRecentActions()]);
    } catch {
      // Silently handle
    } finally {
      setMarkingDoneId(null);
    }
  }

  async function handleGenerateNew() {
    setGenerating(true);
    try {
      const res = await fetch('/api/relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today }),
      });
      const action: RelationshipAction = await res.json();
      setTodayActions(prev => [...prev, action]);
      await fetchRecentActions();
    } catch {
      // Silently handle
    } finally {
      setGenerating(false);
    }
  }

  async function handleQuickAction(e: React.FormEvent) {
    e.preventDefault();
    if (!quickPerson.trim()) return;
    setQuickGenerating(true);
    try {
      const res = await fetch('/api/relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, person: quickPerson.trim() }),
      });
      const action: RelationshipAction = await res.json();
      setTodayActions(prev => [...prev, action]);
      setQuickPerson('');
      await fetchRecentActions();
    } catch {
      // Silently handle
    } finally {
      setQuickGenerating(false);
    }
  }

  async function copyToClipboard(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback: silently handle
    }
  }

  // -------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------

  const primaryAction = todayActions[0] || null;
  const hasBilingual = primaryAction?.messageDraftEs != null;

  // -------------------------------------------------------------------
  // Loading skeleton
  // -------------------------------------------------------------------

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse pb-20 lg:pb-0">
        <div className="h-8 bg-surface rounded w-48 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
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
        <h1 className="text-2xl font-semibold">People</h1>
        <p className="text-muted text-sm mt-1">
          Small loving actions, every day
        </p>
      </header>

      <div className="space-y-6">
        {/* ================================================================
            TODAY'S LOVING ACTION
            ================================================================ */}
        {primaryAction ? (
          <div className="bg-surface border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-muted">
                Today&apos;s Loving Action
              </h2>
              {primaryAction.completed && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-success/10 text-success">
                  Done
                </span>
              )}
            </div>

            {/* Person name */}
            <p className="text-xs text-muted mb-1">For</p>
            <p className="text-lg font-semibold mb-3">{primaryAction.person}</p>

            {/* Action */}
            <p
              className={`text-sm mb-4 ${
                primaryAction.completed ? 'line-through text-muted' : ''
              }`}
            >
              {primaryAction.action}
            </p>

            {/* Message Draft section */}
            {primaryAction.messageDraft && (
              <div className="space-y-3 mb-4">
                {/* English draft */}
                <div className={`rounded-lg border border-border p-4 ${hasBilingual ? '' : ''}`}>
                  {hasBilingual && (
                    <p className="text-xs text-muted mb-1.5 font-medium uppercase tracking-wide">
                      English
                    </p>
                  )}
                  <p className="text-sm italic leading-relaxed">
                    &ldquo;{primaryAction.messageDraft}&rdquo;
                  </p>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        primaryAction.messageDraft!,
                        `en-${primaryAction.id}`,
                      )
                    }
                    className="mt-2 flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors"
                  >
                    {copiedId === `en-${primaryAction.id}` ? (
                      <>
                        <CheckIcon />
                        Copied
                      </>
                    ) : (
                      <>
                        <ClipboardIcon />
                        Copy to clipboard
                      </>
                    )}
                  </button>
                </div>

                {/* Spanish draft */}
                {hasBilingual && primaryAction.messageDraftEs && (
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs text-muted mb-1.5 font-medium uppercase tracking-wide">
                      Espa&ntilde;ol
                    </p>
                    <p className="text-sm italic leading-relaxed">
                      &ldquo;{primaryAction.messageDraftEs}&rdquo;
                    </p>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          primaryAction.messageDraftEs!,
                          `es-${primaryAction.id}`,
                        )
                      }
                      className="mt-2 flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition-colors"
                    >
                      {copiedId === `es-${primaryAction.id}` ? (
                        <>
                          <CheckIcon />
                          Copied
                        </>
                      ) : (
                        <>
                          <ClipboardIcon />
                          Copy to clipboard
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {!primaryAction.completed && (
                <button
                  onClick={() => handleMarkDone(primaryAction.id)}
                  disabled={markingDoneId === primaryAction.id}
                  className="flex-1 py-2 px-4 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {markingDoneId === primaryAction.id
                    ? 'Marking...'
                    : 'Mark Done'}
                </button>
              )}
              <button
                onClick={handleGenerateNew}
                disabled={generating}
                className="flex-1 py-2 px-4 rounded-lg text-sm font-medium border border-border text-muted hover:text-foreground hover:border-accent/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? 'Generating...' : 'Generate New'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-lg p-8 text-center">
            <p className="text-muted text-sm mb-4">
              No loving action for today yet.
            </p>
            <button
              onClick={handleGenerateNew}
              disabled={generating}
              className="py-2 px-6 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? 'Generating...' : 'Generate Today\u2019s Action'}
            </button>
          </div>
        )}

        {/* ================================================================
            ADDITIONAL TODAY ACTIONS (if more than one was generated)
            ================================================================ */}
        {todayActions.length > 1 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted">
              More Actions Today
            </h2>
            {todayActions.slice(1).map(action => (
              <div
                key={action.id}
                className="bg-surface border border-border rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {action.person}
                      </span>
                      {action.completed && (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-success/10 text-success">
                          Done
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-sm ${
                        action.completed ? 'line-through text-muted' : ''
                      }`}
                    >
                      {action.action}
                    </p>

                    {/* Message drafts for additional actions */}
                    {action.messageDraft && (
                      <div className="mt-2 space-y-2">
                        <div className="rounded border border-border p-3">
                          {action.messageDraftEs && (
                            <p className="text-xs text-muted mb-1 font-medium uppercase tracking-wide">
                              English
                            </p>
                          )}
                          <p className="text-xs italic">
                            &ldquo;{action.messageDraft}&rdquo;
                          </p>
                          <button
                            onClick={() =>
                              copyToClipboard(
                                action.messageDraft!,
                                `en-${action.id}`,
                              )
                            }
                            className="mt-1.5 flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
                          >
                            {copiedId === `en-${action.id}` ? (
                              <>
                                <CheckIcon />
                                Copied
                              </>
                            ) : (
                              <>
                                <ClipboardIcon />
                                Copy
                              </>
                            )}
                          </button>
                        </div>

                        {action.messageDraftEs && (
                          <div className="rounded border border-border p-3">
                            <p className="text-xs text-muted mb-1 font-medium uppercase tracking-wide">
                              Espa&ntilde;ol
                            </p>
                            <p className="text-xs italic">
                              &ldquo;{action.messageDraftEs}&rdquo;
                            </p>
                            <button
                              onClick={() =>
                                copyToClipboard(
                                  action.messageDraftEs!,
                                  `es-${action.id}`,
                                )
                              }
                              className="mt-1.5 flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
                            >
                              {copiedId === `es-${action.id}` ? (
                                <>
                                  <CheckIcon />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <ClipboardIcon />
                                  Copy
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Mark done button */}
                  {!action.completed && (
                    <button
                      onClick={() => handleMarkDone(action.id)}
                      disabled={markingDoneId === action.id}
                      className="shrink-0 w-8 h-8 rounded-full border-2 border-border hover:border-accent hover:bg-accent-light transition-colors flex items-center justify-center disabled:opacity-50"
                      aria-label={`Mark done: ${action.action}`}
                    >
                      {markingDoneId === action.id ? (
                        <SpinnerIcon />
                      ) : null}
                    </button>
                  )}
                  {action.completed && (
                    <div className="shrink-0 w-8 h-8 rounded-full bg-success flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ================================================================
            QUICK ACTION FOR SOMEONE ELSE
            ================================================================ */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <h2 className="text-sm font-medium text-muted mb-3">
            Quick Action for Someone Else
          </h2>
          <form onSubmit={handleQuickAction} className="flex gap-2">
            <input
              type="text"
              value={quickPerson}
              onChange={e => setQuickPerson(e.target.value)}
              placeholder="Person's name..."
              className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:border-accent placeholder:text-muted"
            />
            <button
              type="submit"
              disabled={quickGenerating || !quickPerson.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              {quickGenerating ? 'Generating...' : 'Generate Action'}
            </button>
          </form>
        </div>

        {/* ================================================================
            RECENT ACTIONS HISTORY
            ================================================================ */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="text-sm font-medium text-muted">
              Recent Actions
              {recentActions.length > 0 && (
                <span className="font-normal ml-1">
                  ({recentActions.length})
                </span>
              )}
            </h2>
          </div>

          {recentActions.length > 0 ? (
            <div className="divide-y divide-border">
              {recentActions.map(action => (
                <div
                  key={action.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-accent-light/30 transition-colors"
                >
                  {/* Status indicator */}
                  {action.completed ? (
                    <div className="shrink-0 w-5 h-5 rounded-full bg-success flex items-center justify-center">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  ) : (
                    <div className="shrink-0 w-5 h-5 rounded-full border-2 border-border" />
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm truncate ${
                          action.completed ? 'text-muted' : ''
                        }`}
                      >
                        {action.action}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-accent font-medium">
                        {action.person}
                      </span>
                      <span className="text-xs text-muted">
                        {formatDate(action.date)}
                      </span>
                    </div>
                  </div>

                  {/* Mark done if incomplete and is today */}
                  {!action.completed && action.date === today && (
                    <button
                      onClick={() => handleMarkDone(action.id)}
                      disabled={markingDoneId === action.id}
                      className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-border text-muted hover:text-accent hover:border-accent/30 disabled:opacity-50 transition-colors"
                    >
                      {markingDoneId === action.id ? '...' : 'Done'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5">
              <p className="text-sm text-muted">
                No recent actions yet. Generate your first one above.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components (icons)
// ---------------------------------------------------------------------------

function ClipboardIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 text-success"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 animate-spin text-accent"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
