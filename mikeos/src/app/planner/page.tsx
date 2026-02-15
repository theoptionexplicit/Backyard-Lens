'use client';

import { useEffect, useState, useCallback } from 'react';

interface PlanBlock {
  id: string;
  planDate: string;
  taskId?: string;
  eventId?: string;
  title: string;
  start: string;
  end: string;
  type: 'fixed' | 'distributed' | 'break';
  completed: boolean;
  completedAt?: string;
}

interface Task {
  id: string;
  title: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  estimatedMinutes?: number;
  dueDate?: string;
  notes?: string;
  createdAt: string;
}

function formatDateDisplay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split('T')[0];
}

export default function PlannerPage() {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [blocks, setBlocks] = useState<PlanBlock[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  // Task input form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCategory, setTaskCategory] = useState('general');
  const [taskPriority, setTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [taskEstimate, setTaskEstimate] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);

  const fetchPlan = useCallback(async () => {
    try {
      const res = await fetch(`/api/planner?date=${date}`);
      const data = await res.json();
      setBlocks(data.blocks || []);
    } catch {
      setBlocks([]);
    }
  }, [date]);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/ingest?type=tasks');
      const data = await res.json();
      setTasks(data || []);
    } catch {
      setTasks([]);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchPlan(), fetchTasks()]).finally(() => setLoading(false));
  }, [fetchPlan, fetchTasks]);

  async function handleGeneratePlan() {
    setGenerating(true);
    try {
      const body: { date: string; taskIds?: string[] } = { date };
      if (selectedTaskIds.size > 0) {
        body.taskIds = Array.from(selectedTaskIds);
      }
      const res = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setBlocks(data.blocks || []);
    } catch {
      // Plan generation failed silently
    } finally {
      setGenerating(false);
    }
  }

  async function handleCompleteBlock(blockId: string) {
    setCompletingId(blockId);
    try {
      const res = await fetch('/api/planner', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, completedBlockId: blockId }),
      });
      const data = await res.json();
      setBlocks(data.blocks || []);
      // Refresh tasks since completing a block may mark a task complete
      await fetchTasks();
    } catch {
      // Completion failed silently
    } finally {
      setCompletingId(null);
    }
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    setAddingTask(true);
    try {
      const body: Record<string, unknown> = {
        type: 'task',
        title: taskTitle.trim(),
        category: taskCategory,
        priority: taskPriority,
      };
      if (taskEstimate) {
        body.estimatedMinutes = parseInt(taskEstimate, 10);
      }

      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const newTask = await res.json();
        setTaskTitle('');
        setTaskEstimate('');
        setShowTaskForm(false);
        await fetchTasks();
        // Auto-select newly added task
        if (newTask.id) {
          setSelectedTaskIds(prev => new Set(prev).add(newTask.id));
        }
      }
    } catch {
      // Task creation failed silently
    } finally {
      setAddingTask(false);
    }
  }

  function toggleTaskSelection(taskId: string) {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  function selectAllTasks() {
    if (selectedTaskIds.size === tasks.length) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(tasks.map(t => t.id)));
    }
  }

  const completedCount = blocks.filter(b => b.completed).length;
  const totalCount = blocks.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse pb-20 lg:pb-0">
        <div className="h-8 bg-surface rounded w-48 mb-6" />
        <div className="h-12 bg-surface rounded-lg mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-surface rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20 lg:pb-0">
      {/* Header with date navigation */}
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Planner</h1>
            <p className="text-muted text-sm mt-1">
              {isToday(date) ? 'Today' : formatDateDisplay(date)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDate(d => shiftDate(d, -1))}
              className="p-2 rounded-lg text-muted hover:bg-surface hover:text-foreground transition-colors"
              aria-label="Previous day"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {!isToday(date) && (
              <button
                onClick={() => setDate(new Date().toISOString().split('T')[0])}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-accent bg-accent-light hover:bg-accent/20 transition-colors"
              >
                Today
              </button>
            )}
            <button
              onClick={() => setDate(d => shiftDate(d, 1))}
              className="p-2 rounded-lg text-muted hover:bg-surface hover:text-foreground transition-colors"
              aria-label="Next day"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main timeline column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Progress bar */}
          {blocks.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-xs text-muted">
                  {completedCount}/{totalCount} blocks ({progressPct}%)
                </span>
              </div>
              <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Generate Plan button */}
          <button
            onClick={handleGeneratePlan}
            disabled={generating}
            className="w-full py-3 px-4 rounded-lg font-medium text-sm bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? 'Generating...' : blocks.length > 0 ? 'Regenerate Plan' : 'Generate Plan'}
          </button>

          {/* Timeline */}
          {blocks.length > 0 ? (
            <div className="space-y-2">
              {blocks.map(block => (
                <TimelineBlock
                  key={block.id}
                  block={block}
                  onComplete={handleCompleteBlock}
                  completing={completingId === block.id}
                />
              ))}
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-lg p-8 text-center">
              <p className="text-muted text-sm">
                No plan for this day yet. Select tasks below and hit Generate Plan.
              </p>
            </div>
          )}
        </div>

        {/* Sidebar: tasks */}
        <div className="space-y-4">
          {/* Add task form toggle */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setShowTaskForm(!showTaskForm)}
              className="w-full flex items-center justify-between p-4 text-sm font-medium hover:bg-accent-light/50 transition-colors"
            >
              <span>Add Task</span>
              <svg
                className={`w-4 h-4 text-muted transition-transform ${showTaskForm ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showTaskForm && (
              <form onSubmit={handleAddTask} className="p-4 pt-0 space-y-3">
                <div>
                  <input
                    type="text"
                    value={taskTitle}
                    onChange={e => setTaskTitle(e.target.value)}
                    placeholder="Task title..."
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:border-accent placeholder:text-muted"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={taskPriority}
                    onChange={e => setTaskPriority(e.target.value as 'high' | 'medium' | 'low')}
                    className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:border-accent"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>

                  <input
                    type="number"
                    value={taskEstimate}
                    onChange={e => setTaskEstimate(e.target.value)}
                    placeholder="Est. min"
                    min={1}
                    className="px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:border-accent placeholder:text-muted"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    value={taskCategory}
                    onChange={e => setTaskCategory(e.target.value)}
                    placeholder="Category"
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:border-accent placeholder:text-muted"
                  />
                </div>

                <button
                  type="submit"
                  disabled={addingTask || !taskTitle.trim()}
                  className="w-full py-2 px-3 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {addingTask ? 'Adding...' : 'Add Task'}
                </button>
              </form>
            )}
          </div>

          {/* Task selection list */}
          <div className="bg-surface border border-border rounded-lg">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-sm font-medium">
                Tasks
                {tasks.length > 0 && (
                  <span className="text-muted font-normal ml-1">({tasks.length})</span>
                )}
              </h2>
              {tasks.length > 0 && (
                <button
                  onClick={selectAllTasks}
                  className="text-xs text-accent hover:text-accent/80 transition-colors"
                >
                  {selectedTaskIds.size === tasks.length ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>

            {tasks.length > 0 ? (
              <div className="divide-y divide-border max-h-96 overflow-y-auto">
                {tasks.map(task => (
                  <label
                    key={task.id}
                    className="flex items-start gap-3 p-3 hover:bg-accent-light/30 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.has(task.id)}
                      onChange={() => toggleTaskSelection(task.id)}
                      className="mt-0.5 rounded border-border text-accent focus:ring-accent"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm truncate">{task.title}</span>
                        <span
                          className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-mono ${
                            task.priority === 'high'
                              ? 'bg-danger/10 text-danger'
                              : task.priority === 'medium'
                              ? 'bg-warning/10 text-warning'
                              : 'bg-accent-light text-accent'
                          }`}
                        >
                          {task.priority[0]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted">{task.category}</span>
                        {task.estimatedMinutes && (
                          <span className="text-xs text-muted">
                            {task.estimatedMinutes}m
                          </span>
                        )}
                        {task.dueDate && (
                          <span className="text-xs text-warning">
                            due {task.dueDate}
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="p-4">
                <p className="text-sm text-muted">No open tasks. Add one above.</p>
              </div>
            )}

            {selectedTaskIds.size > 0 && (
              <div className="p-3 border-t border-border">
                <p className="text-xs text-muted">
                  {selectedTaskIds.size} task{selectedTaskIds.size !== 1 ? 's' : ''} selected for plan
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineBlock({
  block,
  onComplete,
  completing,
}: {
  block: PlanBlock;
  onComplete: (id: string) => void;
  completing: boolean;
}) {
  const typeStyles: Record<string, string> = {
    fixed: 'border-l-accent bg-accent-light/30',
    distributed: 'border-l-foreground/20 bg-surface',
    break: 'border-l-muted/40 bg-surface',
  };

  const typeBadgeStyles: Record<string, string> = {
    fixed: 'bg-accent/10 text-accent',
    distributed: 'bg-accent-light text-foreground',
    break: 'bg-border text-muted',
  };

  return (
    <div
      className={`border border-border rounded-lg p-4 border-l-4 transition-all ${
        typeStyles[block.type] || typeStyles.distributed
      } ${block.completed ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Completion button (only for non-break, non-completed blocks) */}
        <div className="pt-0.5">
          {block.type !== 'break' && !block.completed ? (
            <button
              onClick={() => onComplete(block.id)}
              disabled={completing}
              className="w-5 h-5 rounded-full border-2 border-border hover:border-accent hover:bg-accent-light transition-colors flex items-center justify-center disabled:opacity-50"
              aria-label={`Complete ${block.title}`}
            >
              {completing && (
                <svg className="w-3 h-3 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
            </button>
          ) : block.completed ? (
            <div className="w-5 h-5 rounded-full bg-success flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="w-5 h-5" />
          )}
        </div>

        {/* Block content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium ${block.completed ? 'line-through text-muted' : ''}`}>
              {block.title}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${typeBadgeStyles[block.type] || typeBadgeStyles.distributed}`}>
              {block.type}
            </span>
          </div>
          <p className="text-xs text-muted font-mono mt-1">
            {block.start} - {block.end}
          </p>
        </div>
      </div>
    </div>
  );
}
