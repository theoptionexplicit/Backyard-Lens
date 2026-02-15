'use client';

import { useEffect, useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProjectType = 'art' | 'music' | 'writing' | 'code' | 'other';
type ProjectStatus = 'idea' | 'in_progress' | 'review' | 'shipped';

interface CreativePrompt {
  prompt: string;
  constraint: string;
}

interface Project {
  id: string;
  title: string;
  type: ProjectType;
  status: ProjectStatus;
  description: string;
  notes?: string;
  shippedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_TYPES: ProjectType[] = ['art', 'music', 'writing', 'code', 'other'];

const STATUS_COLUMNS: { key: ProjectStatus; label: string }[] = [
  { key: 'idea', label: 'Ideas' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'review', label: 'Review' },
  { key: 'shipped', label: 'Shipped' },
];

const TYPE_BADGE_STYLES: Record<ProjectType, string> = {
  art: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  music: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  writing: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  code: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  other: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const STATUS_NEXT: Record<ProjectStatus, ProjectStatus | null> = {
  idea: 'in_progress',
  in_progress: 'review',
  review: 'shipped',
  shipped: null,
};

const STATUS_PREV: Record<ProjectStatus, ProjectStatus | null> = {
  idea: null,
  in_progress: 'idea',
  review: 'in_progress',
  shipped: 'review',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StudioPage() {
  // --- Prompt state ---
  const [prompt, setPrompt] = useState<CreativePrompt | null>(null);
  const [promptType, setPromptType] = useState<ProjectType | ''>('');
  const [loadingPrompt, setLoadingPrompt] = useState(true);

  // --- Projects state ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // --- Create form state ---
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createType, setCreateType] = useState<ProjectType>('writing');
  const [createDescription, setCreateDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // --- Expanded project (detail view) ---
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // --- Inline edit state ---
  const [editingField, setEditingField] = useState<{ id: string; field: 'description' | 'notes' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  // --- Action loading states ---
  const [movingId, setMovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // -------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------

  const fetchPrompt = useCallback(async (type?: string) => {
    setLoadingPrompt(true);
    try {
      const url = type
        ? `/api/creative?prompt=1&type=${type}`
        : '/api/creative?prompt=1';
      const res = await fetch(url);
      const data = await res.json();
      setPrompt(data);
    } catch {
      // Silently handle
    } finally {
      setLoadingPrompt(false);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/creative');
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : data.projects || []);
    } catch {
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    fetchPrompt();
    fetchProjects();
  }, [fetchPrompt, fetchProjects]);

  // -------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------

  function handlePromptTypeChange(type: ProjectType | '') {
    setPromptType(type);
    fetchPrompt(type || undefined);
  }

  async function handleStartFromPrompt() {
    if (!prompt) return;
    setCreateTitle(prompt.prompt.length > 80 ? prompt.prompt.slice(0, 80) + '...' : prompt.prompt);
    setCreateDescription(`${prompt.prompt}\n\nConstraint: ${prompt.constraint}`);
    setCreateType(promptType ? promptType as ProjectType : 'writing');
    setShowCreateForm(true);
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!createTitle.trim()) return;

    setCreating(true);
    try {
      const res = await fetch('/api/creative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createTitle.trim(),
          type: createType,
          description: createDescription.trim(),
        }),
      });

      if (res.ok) {
        setCreateTitle('');
        setCreateDescription('');
        setCreateType('writing');
        setShowCreateForm(false);
        await fetchProjects();
      }
    } catch {
      // Silently handle
    } finally {
      setCreating(false);
    }
  }

  async function handleMoveStatus(id: string, status: ProjectStatus) {
    setMovingId(id);
    try {
      await fetch('/api/creative', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      await fetchProjects();
    } catch {
      // Silently handle
    } finally {
      setMovingId(null);
    }
  }

  async function handleShip(id: string) {
    setMovingId(id);
    try {
      await fetch('/api/creative', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'ship' }),
      });
      await fetchProjects();
    } catch {
      // Silently handle
    } finally {
      setMovingId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/creative?id=${id}`, { method: 'DELETE' });
      if (expandedId === id) setExpandedId(null);
      await fetchProjects();
    } catch {
      // Silently handle
    } finally {
      setDeletingId(null);
    }
  }

  function startEditing(project: Project, field: 'description' | 'notes') {
    setEditingField({ id: project.id, field });
    setEditValue(field === 'notes' ? (project.notes || '') : project.description);
  }

  async function handleSaveEdit() {
    if (!editingField) return;
    setSaving(true);
    try {
      await fetch('/api/creative', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingField.id,
          [editingField.field]: editValue,
        }),
      });
      setEditingField(null);
      setEditValue('');
      await fetchProjects();
    } catch {
      // Silently handle
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setEditingField(null);
    setEditValue('');
  }

  // -------------------------------------------------------------------
  // Derived data
  // -------------------------------------------------------------------

  const projectsByStatus = (status: ProjectStatus) =>
    projects.filter(p => p.status === status);

  const expandedProject = projects.find(p => p.id === expandedId) || null;

  // -------------------------------------------------------------------
  // Loading skeleton
  // -------------------------------------------------------------------

  if (loadingProjects && loadingPrompt) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse pb-20 lg:pb-0">
        <div className="h-8 bg-surface rounded w-48 mb-6" />
        <div className="h-32 bg-surface rounded-lg mb-4" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-40 bg-surface rounded-lg" />
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
        <h1 className="text-2xl font-semibold">Studio</h1>
        <p className="text-muted text-sm mt-1">Create, ship, repeat</p>
      </header>

      <div className="space-y-6">
        {/* ================================================================
            DAILY CREATIVE PROMPT
            ================================================================ */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-muted">Daily Creative Prompt</h2>
            <select
              value={promptType}
              onChange={e => handlePromptTypeChange(e.target.value as ProjectType | '')}
              className="px-2 py-1 text-xs bg-background border border-border rounded-lg focus:outline-none focus:border-accent"
            >
              <option value="">Any type</option>
              {PROJECT_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {loadingPrompt ? (
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-border rounded w-3/4" />
              <div className="h-3 bg-border rounded w-1/2" />
            </div>
          ) : prompt ? (
            <div>
              <p className="text-sm leading-relaxed">{prompt.prompt}</p>
              <p className="text-xs text-muted mt-2 italic">{prompt.constraint}</p>
              <button
                onClick={handleStartFromPrompt}
                className="mt-3 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
              >
                Start from this prompt
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted">No prompt available.</p>
          )}
        </div>

        {/* ================================================================
            CREATE NEW PROJECT
            ================================================================ */}
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="w-full flex items-center justify-between p-4 text-sm font-medium hover:bg-accent-light/50 transition-colors"
          >
            <span>New Project</span>
            <svg
              className={`w-4 h-4 text-muted transition-transform ${showCreateForm ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showCreateForm && (
            <form onSubmit={handleCreateProject} className="p-4 pt-0 space-y-3">
              <div>
                <label className="block text-xs text-muted mb-1">Title</label>
                <input
                  type="text"
                  value={createTitle}
                  onChange={e => setCreateTitle(e.target.value)}
                  placeholder="Project title..."
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:border-accent placeholder:text-muted"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1">Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {PROJECT_TYPES.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCreateType(t)}
                      className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                        createType === t
                          ? TYPE_BADGE_STYLES[t]
                          : 'bg-background border border-border text-muted hover:text-foreground'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1">Description</label>
                <textarea
                  value={createDescription}
                  onChange={e => setCreateDescription(e.target.value)}
                  placeholder="What are you making?"
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:border-accent placeholder:text-muted resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={creating || !createTitle.trim()}
                className="w-full py-2 px-3 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creating ? 'Creating...' : 'Create Project'}
              </button>
            </form>
          )}
        </div>

        {/* ================================================================
            EXPANDED PROJECT DETAIL
            ================================================================ */}
        {expandedProject && (
          <div className="bg-surface border border-border rounded-lg p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h2 className="text-lg font-semibold">{expandedProject.title}</h2>
                  <TypeBadge type={expandedProject.type} />
                  <StatusBadge status={expandedProject.status} />
                </div>
                <p className="text-xs text-muted">
                  Created {formatDate(expandedProject.createdAt)}
                  {expandedProject.shippedAt && (
                    <> &middot; Shipped {formatDate(expandedProject.shippedAt)}</>
                  )}
                </p>
              </div>
              <button
                onClick={() => setExpandedId(null)}
                className="shrink-0 p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-background transition-colors"
                aria-label="Close details"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Description */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-muted font-medium">Description</label>
                {editingField?.id !== expandedProject.id || editingField?.field !== 'description' ? (
                  <button
                    onClick={() => startEditing(expandedProject, 'description')}
                    className="text-xs text-accent hover:text-accent/80 transition-colors"
                  >
                    Edit
                  </button>
                ) : null}
              </div>
              {editingField?.id === expandedProject.id && editingField?.field === 'description' ? (
                <div className="space-y-2">
                  <textarea
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:border-accent resize-none"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="px-3 py-1.5 text-xs rounded-lg font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1.5 text-xs rounded-lg font-medium border border-border text-muted hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">
                  {expandedProject.description || <span className="text-muted italic">No description</span>}
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-muted font-medium">Notes</label>
                {editingField?.id !== expandedProject.id || editingField?.field !== 'notes' ? (
                  <button
                    onClick={() => startEditing(expandedProject, 'notes')}
                    className="text-xs text-accent hover:text-accent/80 transition-colors"
                  >
                    Edit
                  </button>
                ) : null}
              </div>
              {editingField?.id === expandedProject.id && editingField?.field === 'notes' ? (
                <div className="space-y-2">
                  <textarea
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:border-accent resize-none"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="px-3 py-1.5 text-xs rounded-lg font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1.5 text-xs rounded-lg font-medium border border-border text-muted hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">
                  {expandedProject.notes || <span className="text-muted italic">No notes yet</span>}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
              {/* Move backward */}
              {STATUS_PREV[expandedProject.status] && (
                <button
                  onClick={() => handleMoveStatus(expandedProject.id, STATUS_PREV[expandedProject.status]!)}
                  disabled={movingId === expandedProject.id}
                  className="px-3 py-1.5 text-xs rounded-lg font-medium border border-border text-muted hover:text-foreground hover:border-accent/30 disabled:opacity-50 transition-colors"
                >
                  {movingId === expandedProject.id ? '...' : `Move to ${STATUS_PREV[expandedProject.status]!.replace('_', ' ')}`}
                </button>
              )}

              {/* Move forward */}
              {STATUS_NEXT[expandedProject.status] && expandedProject.status !== 'review' && (
                <button
                  onClick={() => handleMoveStatus(expandedProject.id, STATUS_NEXT[expandedProject.status]!)}
                  disabled={movingId === expandedProject.id}
                  className="px-3 py-1.5 text-xs rounded-lg font-medium bg-accent-light text-accent hover:bg-accent/20 disabled:opacity-50 transition-colors"
                >
                  {movingId === expandedProject.id ? '...' : `Move to ${STATUS_NEXT[expandedProject.status]!.replace('_', ' ')}`}
                </button>
              )}

              {/* Ship it */}
              {expandedProject.status === 'review' && (
                <button
                  onClick={() => handleShip(expandedProject.id)}
                  disabled={movingId === expandedProject.id}
                  className="px-3 py-1.5 text-xs rounded-lg font-medium bg-success/10 text-success hover:bg-success/20 disabled:opacity-50 transition-colors"
                >
                  {movingId === expandedProject.id ? 'Shipping...' : 'Ship it'}
                </button>
              )}

              {/* Delete */}
              <button
                onClick={() => handleDelete(expandedProject.id)}
                disabled={deletingId === expandedProject.id}
                className="px-3 py-1.5 text-xs rounded-lg font-medium text-danger hover:bg-danger/10 disabled:opacity-50 transition-colors ml-auto"
              >
                {deletingId === expandedProject.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        )}

        {/* ================================================================
            PROJECTS BOARD
            ================================================================ */}
        <div>
          <h2 className="text-sm font-medium text-muted mb-3">
            Projects
            {projects.length > 0 && (
              <span className="font-normal ml-1">({projects.length})</span>
            )}
          </h2>

          {projects.length === 0 && !loadingProjects ? (
            <div className="bg-surface border border-border rounded-lg p-8 text-center">
              <p className="text-sm text-muted">
                No projects yet. Create one above or start from today&apos;s prompt.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {STATUS_COLUMNS.map(col => {
                const columnProjects = projectsByStatus(col.key);
                return (
                  <div key={col.key} className="bg-surface border border-border rounded-lg overflow-hidden">
                    {/* Column header */}
                    <div className="flex items-center justify-between p-3 border-b border-border">
                      <div className="flex items-center gap-2">
                        <StatusDot status={col.key} />
                        <span className="text-sm font-medium">{col.label}</span>
                      </div>
                      {columnProjects.length > 0 && (
                        <span className="text-xs text-muted">{columnProjects.length}</span>
                      )}
                    </div>

                    {/* Cards */}
                    {columnProjects.length > 0 ? (
                      <div className="divide-y divide-border">
                        {columnProjects.map(project => (
                          <ProjectCard
                            key={project.id}
                            project={project}
                            isExpanded={expandedId === project.id}
                            isMoving={movingId === project.id}
                            isDeleting={deletingId === project.id}
                            onExpand={() => setExpandedId(expandedId === project.id ? null : project.id)}
                            onMoveForward={
                              STATUS_NEXT[project.status]
                                ? () => {
                                    if (project.status === 'review') {
                                      handleShip(project.id);
                                    } else {
                                      handleMoveStatus(project.id, STATUS_NEXT[project.status]!);
                                    }
                                  }
                                : undefined
                            }
                            onDelete={() => handleDelete(project.id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="p-4">
                        <p className="text-xs text-muted text-center">No projects</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Individual project card in a kanban column */
function ProjectCard({
  project,
  isExpanded,
  isMoving,
  isDeleting,
  onExpand,
  onMoveForward,
  onDelete,
}: {
  project: Project;
  isExpanded: boolean;
  isMoving: boolean;
  isDeleting: boolean;
  onExpand: () => void;
  onMoveForward?: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`p-3 hover:bg-accent-light/30 transition-colors ${
        isExpanded ? 'bg-accent-light/20' : ''
      }`}
    >
      {/* Clickable header */}
      <button
        onClick={onExpand}
        className="w-full text-left"
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium truncate flex-1">{project.title}</span>
          <TypeBadge type={project.type} />
        </div>
        {project.description && (
          <p className="text-xs text-muted line-clamp-2">
            {project.description}
          </p>
        )}
      </button>

      {/* Inline quick actions */}
      <div className="flex items-center gap-1.5 mt-2">
        {onMoveForward && (
          <button
            onClick={e => { e.stopPropagation(); onMoveForward(); }}
            disabled={isMoving}
            className="text-[10px] px-2 py-1 rounded font-medium bg-accent-light text-accent hover:bg-accent/20 disabled:opacity-50 transition-colors"
          >
            {isMoving
              ? '...'
              : project.status === 'review'
              ? 'Ship'
              : 'Advance'}
          </button>
        )}
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          disabled={isDeleting}
          className="text-[10px] px-2 py-1 rounded font-medium text-danger hover:bg-danger/10 disabled:opacity-50 transition-colors ml-auto"
        >
          {isDeleting ? '...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

/** Color-coded type badge */
function TypeBadge({ type }: { type: ProjectType }) {
  return (
    <span
      className={`shrink-0 text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded ${
        TYPE_BADGE_STYLES[type] || TYPE_BADGE_STYLES.other
      }`}
    >
      {type}
    </span>
  );
}

/** Status badge for expanded detail view */
function StatusBadge({ status }: { status: ProjectStatus }) {
  const styles: Record<ProjectStatus, string> = {
    idea: 'bg-border text-muted',
    in_progress: 'bg-warning/10 text-warning',
    review: 'bg-accent-light text-accent',
    shipped: 'bg-success/10 text-success',
  };

  const labels: Record<ProjectStatus, string> = {
    idea: 'Idea',
    in_progress: 'In Progress',
    review: 'Review',
    shipped: 'Shipped',
  };

  return (
    <span className={`text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

/** Small colored dot for column headers */
function StatusDot({ status }: { status: ProjectStatus }) {
  const colors: Record<ProjectStatus, string> = {
    idea: 'bg-muted',
    in_progress: 'bg-warning',
    review: 'bg-accent',
    shipped: 'bg-success',
  };

  return <span className={`w-2 h-2 rounded-full ${colors[status]}`} />;
}

/** Format an ISO date string to a readable format */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
