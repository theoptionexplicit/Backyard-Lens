import { v4 as uuid } from 'uuid';
import { getDb, getSetting } from './db';
import type { PlanBlock, CalendarEvent, Task } from '@/types';

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

interface TimeSlot {
  start: number; // minutes from midnight
  end: number;
}

export function generateDailyPlan(date: string, taskIds?: string[]): PlanBlock[] {
  const db = getDb();
  const wakeTime = getSetting('wakeTime') || '07:00';
  const endTime = getSetting('endTime') || '22:00';
  const isLowFriction = getSetting('lowFrictionMode') === 'true';

  const dayStart = timeToMinutes(wakeTime);
  const dayEnd = timeToMinutes(endTime);

  // 1. Get fixed calendar events for this date
  const events = db.prepare(
    `SELECT * FROM calendar_events
     WHERE date(start) = ? AND is_fixed = 1
     ORDER BY start`
  ).all(date) as Array<{
    id: string; title: string; start: string; end: string;
    location: string; description: string; is_fixed: number; source: string;
  }>;

  // 2. Get incomplete tasks (use provided IDs or all incomplete)
  let tasks: Array<{
    id: string; title: string; category: string; priority: string;
    estimated_minutes: number | null; completed: number;
  }>;

  if (taskIds && taskIds.length > 0) {
    const placeholders = taskIds.map(() => '?').join(',');
    tasks = db.prepare(
      `SELECT * FROM tasks WHERE id IN (${placeholders}) AND completed = 0 ORDER BY
       CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END`
    ).all(...taskIds) as typeof tasks;
  } else {
    tasks = db.prepare(
      `SELECT * FROM tasks WHERE completed = 0 ORDER BY
       CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END
       LIMIT 12`
    ).all() as typeof tasks;
  }

  // 3. Convert events to fixed blocks
  const fixedBlocks: PlanBlock[] = events.map(e => {
    const startDate = new Date(e.start);
    const endDate = new Date(e.end);
    const startMin = startDate.getHours() * 60 + startDate.getMinutes();
    const endMin = endDate.getHours() * 60 + endDate.getMinutes();
    return {
      id: uuid(),
      planDate: date,
      eventId: e.id,
      title: e.title,
      start: minutesToTime(Math.max(startMin, dayStart)),
      end: minutesToTime(Math.min(endMin, dayEnd)),
      type: 'fixed' as const,
      completed: false,
    };
  });

  // 4. Find free slots between fixed events
  const occupiedSlots: TimeSlot[] = fixedBlocks.map(b => ({
    start: timeToMinutes(b.start),
    end: timeToMinutes(b.end),
  })).sort((a, b) => a.start - b.start);

  const freeSlots: TimeSlot[] = [];
  let cursor = dayStart;

  for (const slot of occupiedSlots) {
    if (cursor < slot.start) {
      freeSlots.push({ start: cursor, end: slot.start });
    }
    cursor = Math.max(cursor, slot.end);
  }
  if (cursor < dayEnd) {
    freeSlots.push({ start: cursor, end: dayEnd });
  }

  // 5. Calculate total free time
  const totalFreeMinutes = freeSlots.reduce((sum, s) => sum + (s.end - s.start), 0);

  if (tasks.length === 0 || totalFreeMinutes === 0) {
    // Clear old plan blocks for this date and insert fixed blocks only
    db.prepare('DELETE FROM plan_blocks WHERE plan_date = ?').run(date);
    const insert = db.prepare(
      'INSERT INTO plan_blocks (id, plan_date, task_id, event_id, title, start_time, end_time, type, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const block of fixedBlocks) {
      insert.run(block.id, block.planDate, block.taskId || null, block.eventId || null, block.title, block.start, block.end, block.type, 0);
    }
    return fixedBlocks;
  }

  // 6. Distribute time evenly across tasks (no repeats)
  const timePerTask = Math.floor(totalFreeMinutes / tasks.length);
  const maxTaskTime = isLowFriction ? Math.min(timePerTask, 25) : timePerTask; // Pomodoro-sized for low friction

  const distributedBlocks: PlanBlock[] = [];
  let taskIndex = 0;

  for (const freeSlot of freeSlots) {
    let slotCursor = freeSlot.start;

    while (slotCursor < freeSlot.end && taskIndex < tasks.length) {
      const remainingInSlot = freeSlot.end - slotCursor;
      const blockDuration = Math.min(maxTaskTime, remainingInSlot);

      if (blockDuration < 5) break; // Skip tiny fragments

      const task = tasks[taskIndex];
      distributedBlocks.push({
        id: uuid(),
        planDate: date,
        taskId: task.id,
        title: task.title,
        start: minutesToTime(slotCursor),
        end: minutesToTime(slotCursor + blockDuration),
        type: 'distributed',
        completed: false,
      });

      slotCursor += blockDuration;
      taskIndex++;

      // Add a small break between tasks in low friction mode
      if (isLowFriction && slotCursor < freeSlot.end) {
        const breakDuration = Math.min(5, freeSlot.end - slotCursor);
        if (breakDuration >= 3) {
          distributedBlocks.push({
            id: uuid(),
            planDate: date,
            title: '☕ Break',
            start: minutesToTime(slotCursor),
            end: minutesToTime(slotCursor + breakDuration),
            type: 'break',
            completed: false,
          });
          slotCursor += breakDuration;
        }
      }
    }
  }

  // 7. Combine and sort all blocks
  const allBlocks = [...fixedBlocks, ...distributedBlocks].sort(
    (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
  );

  // 8. Save to database
  db.prepare('DELETE FROM plan_blocks WHERE plan_date = ?').run(date);
  const insert = db.prepare(
    'INSERT INTO plan_blocks (id, plan_date, task_id, event_id, title, start_time, end_time, type, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const block of allBlocks) {
    insert.run(block.id, block.planDate, block.taskId || null, block.eventId || null, block.title, block.start, block.end, block.type, 0);
  }

  return allBlocks;
}

export function redistributeAfterCompletion(date: string, completedBlockId: string): PlanBlock[] {
  const db = getDb();
  const endTime = getSetting('endTime') || '22:00';
  const dayEnd = timeToMinutes(endTime);

  // Mark block as completed
  db.prepare(
    'UPDATE plan_blocks SET completed = 1, completed_at = datetime(\'now\') WHERE id = ?'
  ).run(completedBlockId);

  // Also mark the associated task as completed if it has one
  const block = db.prepare('SELECT * FROM plan_blocks WHERE id = ?').get(completedBlockId) as {
    task_id: string | null; end_time: string;
  } | undefined;

  if (block?.task_id) {
    db.prepare(
      'UPDATE tasks SET completed = 1, completed_at = datetime(\'now\') WHERE id = ?'
    ).run(block.task_id);
  }

  // Get current time (the completed block's end time)
  const now = block ? timeToMinutes(block.end_time) : timeToMinutes(new Date().toTimeString().slice(0, 5));

  // Get remaining uncompleted distributed blocks
  const remaining = db.prepare(
    `SELECT * FROM plan_blocks
     WHERE plan_date = ? AND completed = 0 AND type = 'distributed'
     ORDER BY start_time`
  ).all(date) as Array<{
    id: string; plan_date: string; task_id: string; title: string;
    start_time: string; end_time: string; type: string;
  }>;

  if (remaining.length === 0) {
    return db.prepare('SELECT * FROM plan_blocks WHERE plan_date = ? ORDER BY start_time').all(date) as PlanBlock[];
  }

  // Get fixed blocks that haven't happened yet
  const futureFixed = db.prepare(
    `SELECT * FROM plan_blocks
     WHERE plan_date = ? AND type = 'fixed' AND completed = 0
     ORDER BY start_time`
  ).all(date) as Array<{ start_time: string; end_time: string }>;

  // Find free slots from now to end of day (respecting fixed blocks)
  const occupiedSlots: TimeSlot[] = futureFixed.map(b => ({
    start: timeToMinutes(b.start_time),
    end: timeToMinutes(b.end_time),
  }));

  const freeSlots: TimeSlot[] = [];
  let cursor = now;
  for (const slot of occupiedSlots) {
    if (slot.start > cursor) {
      freeSlots.push({ start: cursor, end: slot.start });
    }
    cursor = Math.max(cursor, slot.end);
  }
  if (cursor < dayEnd) {
    freeSlots.push({ start: cursor, end: dayEnd });
  }

  const totalFree = freeSlots.reduce((sum, s) => sum + (s.end - s.start), 0);
  const timePerTask = Math.floor(totalFree / remaining.length);

  // Redistribute
  let taskIdx = 0;
  const updates: { id: string; start: string; end: string }[] = [];

  for (const freeSlot of freeSlots) {
    let slotCursor = freeSlot.start;
    while (slotCursor < freeSlot.end && taskIdx < remaining.length) {
      const duration = Math.min(timePerTask, freeSlot.end - slotCursor);
      if (duration < 5) break;

      updates.push({
        id: remaining[taskIdx].id,
        start: minutesToTime(slotCursor),
        end: minutesToTime(slotCursor + duration),
      });
      slotCursor += duration;
      taskIdx++;
    }
  }

  const update = db.prepare('UPDATE plan_blocks SET start_time = ?, end_time = ? WHERE id = ?');
  for (const u of updates) {
    update.run(u.start, u.end, u.id);
  }

  return db.prepare(
    'SELECT id, plan_date as planDate, task_id as taskId, event_id as eventId, title, start_time as start, end_time as end, type, completed FROM plan_blocks WHERE plan_date = ? ORDER BY start_time'
  ).all(date) as PlanBlock[];
}

export function getPlanForDate(date: string): PlanBlock[] {
  return getDb().prepare(
    'SELECT id, plan_date as planDate, task_id as taskId, event_id as eventId, title, start_time as start, end_time as end, type, completed FROM plan_blocks WHERE plan_date = ? ORDER BY start_time'
  ).all(date) as PlanBlock[];
}
