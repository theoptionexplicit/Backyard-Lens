import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = process.env.MIKEOS_DATA_DIR || path.join(process.cwd(), '.mikeos-data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'mikeos.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      start TEXT NOT NULL,
      end TEXT NOT NULL,
      location TEXT,
      description TEXT,
      is_fixed INTEGER DEFAULT 1,
      source TEXT DEFAULT 'manual',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      priority TEXT DEFAULT 'medium',
      estimated_minutes INTEGER,
      completed INTEGER DEFAULT 0,
      completed_at TEXT,
      due_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plan_blocks (
      id TEXT PRIMARY KEY,
      plan_date TEXT NOT NULL,
      task_id TEXT,
      event_id TEXT,
      title TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      type TEXT DEFAULT 'distributed',
      completed INTEGER DEFAULT 0,
      completed_at TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      FOREIGN KEY (event_id) REFERENCES calendar_events(id)
    );

    CREATE TABLE IF NOT EXISTS health_entries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      value TEXT NOT NULL,
      calories INTEGER,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mood_entries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      mood INTEGER NOT NULL,
      energy INTEGER NOT NULL,
      anxiety INTEGER DEFAULT 5,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sleep_entries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      hours REAL NOT NULL,
      quality INTEGER DEFAULT 5,
      bedtime TEXT,
      wake_time TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS relationship_actions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      person TEXT NOT NULL,
      action TEXT NOT NULL,
      message_draft TEXT,
      message_draft_es TEXT,
      completed INTEGER DEFAULT 0,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS creative_projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT DEFAULT 'other',
      status TEXT DEFAULT 'idea',
      description TEXT,
      notes TEXT,
      assets TEXT DEFAULT '[]',
      prompt TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gratitude_entries (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      items TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS automation_tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT DEFAULT 'custom',
      description TEXT DEFAULT '',
      command TEXT,
      schedule TEXT,
      last_run TEXT,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_health_date ON health_entries(date);
    CREATE INDEX IF NOT EXISTS idx_mood_date ON mood_entries(date);
    CREATE INDEX IF NOT EXISTS idx_sleep_date ON sleep_entries(date);
    CREATE INDEX IF NOT EXISTS idx_plan_date ON plan_blocks(plan_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
    CREATE INDEX IF NOT EXISTS idx_rel_date ON relationship_actions(date);
    CREATE INDEX IF NOT EXISTS idx_gratitude_date ON gratitude_entries(date);
  `);

  // Seed default settings if empty
  const count = db.prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number };
  if (count.c === 0) {
    const defaults: Record<string, string> = {
      wakeTime: '07:00',
      endTime: '22:00',
      lowFrictionMode: 'false',
      veronicaName: 'Veronica',
      bilingual: 'true',
      dailyCalorieTarget: '2000',
      mealLoggingEnabled: 'true',
      healthCheckInsEnabled: 'true',
      creativeMode: 'true',
    };
    const insert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(defaults)) {
      insert.run(key, value);
    }
  }
}

export function getSetting(key: string): string | undefined {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string): void {
  getDb().prepare(
    'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime(\'now\')'
  ).run(key, value, value);
}

export function getAllSettings(): Record<string, string> {
  const rows = getDb().prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}
