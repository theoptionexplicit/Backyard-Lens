import { v4 as uuid } from 'uuid';
import { getDb } from './db';
import fs from 'fs';
import path from 'path';
import type { AutomationTask } from '@/types';

// Predefined automation templates
const AUTOMATION_TEMPLATES: Omit<AutomationTask, 'id' | 'createdAt'>[] = [
  {
    title: 'Clean Downloads folder',
    type: 'file_cleanup',
    description: 'Move files older than 30 days from ~/Downloads to ~/Downloads/_archive',
    enabled: true,
  },
  {
    title: 'Organize screenshots',
    type: 'file_cleanup',
    description: 'Move screenshots from Desktop to ~/Pictures/Screenshots, organized by month',
    enabled: true,
  },
  {
    title: 'Clear browser cache',
    type: 'browser',
    description: 'Reminder to clear browser cache, cookies, and unused extensions',
    enabled: true,
  },
  {
    title: 'Empty Trash',
    type: 'file_cleanup',
    description: 'Empty system trash if over 1GB',
    enabled: true,
  },
  {
    title: 'Organize receipts',
    type: 'receipt',
    description: 'Move receipt PDFs/images from Downloads to ~/Documents/Receipts/{year}/{month}',
    enabled: true,
  },
];

export function getAutomationTasks(): AutomationTask[] {
  const db = getDb();
  const tasks = db.prepare(
    'SELECT id, title, type, description, command, schedule, last_run as lastRun, enabled, created_at as createdAt FROM automation_tasks ORDER BY created_at'
  ).all() as AutomationTask[];

  // Seed templates if empty
  if (tasks.length === 0) {
    const insert = db.prepare(
      'INSERT INTO automation_tasks (id, title, type, description, enabled, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))'
    );
    for (const template of AUTOMATION_TEMPLATES) {
      const id = uuid();
      insert.run(id, template.title, template.type, template.description, template.enabled ? 1 : 0);
    }
    return getAutomationTasks(); // re-fetch after seeding
  }

  return tasks;
}

export function createAutomation(title: string, type: AutomationTask['type'], description: string): AutomationTask {
  const db = getDb();
  const task: AutomationTask = {
    id: uuid(),
    title,
    type,
    description,
    enabled: true,
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    'INSERT INTO automation_tasks (id, title, type, description, enabled, created_at) VALUES (?, ?, ?, ?, 1, ?)'
  ).run(task.id, task.title, task.type, task.description, task.createdAt);

  return task;
}

export function toggleAutomation(id: string): boolean {
  const db = getDb();
  const current = db.prepare('SELECT enabled FROM automation_tasks WHERE id = ?').get(id) as { enabled: number } | undefined;
  if (!current) return false;

  const newState = current.enabled ? 0 : 1;
  db.prepare('UPDATE automation_tasks SET enabled = ? WHERE id = ?').run(newState, id);
  return true;
}

export function runAutomation(id: string): { success: boolean; message: string } {
  const db = getDb();
  const task = db.prepare('SELECT * FROM automation_tasks WHERE id = ?').get(id) as AutomationTask | undefined;
  if (!task) return { success: false, message: 'Automation not found' };

  // Execute based on type
  let message = '';
  try {
    switch (task.type) {
      case 'file_cleanup':
        message = runFileCleanup(task);
        break;
      case 'receipt':
        message = runReceiptOrganizer(task);
        break;
      default:
        message = `Automation "${task.title}" noted. Manual action may be needed.`;
    }

    db.prepare('UPDATE automation_tasks SET last_run = datetime(\'now\') WHERE id = ?').run(id);
    return { success: true, message };
  } catch (err) {
    return { success: false, message: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` };
  }
}

function runFileCleanup(task: AutomationTask): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
  const downloadsDir = path.join(homeDir, 'Downloads');

  if (!fs.existsSync(downloadsDir)) {
    return 'Downloads folder not found';
  }

  const archiveDir = path.join(downloadsDir, '_archive');
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  let movedCount = 0;

  const files = fs.readdirSync(downloadsDir);
  for (const file of files) {
    if (file === '_archive' || file.startsWith('.')) continue;
    const fullPath = path.join(downloadsDir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isFile() && stat.mtimeMs < thirtyDaysAgo) {
      fs.renameSync(fullPath, path.join(archiveDir, file));
      movedCount++;
    }
  }

  return `Moved ${movedCount} files older than 30 days to _archive`;
}

function runReceiptOrganizer(task: AutomationTask): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
  const downloadsDir = path.join(homeDir, 'Downloads');
  const receiptsDir = path.join(homeDir, 'Documents', 'Receipts');

  if (!fs.existsSync(downloadsDir)) {
    return 'Downloads folder not found';
  }

  let movedCount = 0;
  const receiptPatterns = /receipt|invoice|payment|order.*confirm/i;

  const files = fs.readdirSync(downloadsDir);
  for (const file of files) {
    if (receiptPatterns.test(file)) {
      const ext = path.extname(file).toLowerCase();
      if (['.pdf', '.png', '.jpg', '.jpeg'].includes(ext)) {
        const now = new Date();
        const yearMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
        const destDir = path.join(receiptsDir, yearMonth);

        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }

        fs.renameSync(path.join(downloadsDir, file), path.join(destDir, file));
        movedCount++;
      }
    }
  }

  return `Organized ${movedCount} receipt files`;
}

export function deleteAutomation(id: string): boolean {
  const result = getDb().prepare('DELETE FROM automation_tasks WHERE id = ?').run(id);
  return result.changes > 0;
}
