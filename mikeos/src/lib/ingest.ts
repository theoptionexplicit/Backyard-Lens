import { v4 as uuid } from 'uuid';
import { getDb } from './db';
import fs from 'fs';
import path from 'path';
import type { CalendarEvent, Note, GratitudeEntry } from '@/types';

// Parse ICS calendar files
export function ingestICS(icsContent: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const lines = icsContent.split('\n').map(l => l.trim());

  let current: Partial<CalendarEvent> | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = { id: uuid(), source: 'ical', isFixed: true };
    } else if (line === 'END:VEVENT' && current) {
      if (current.title && current.start && current.end) {
        events.push(current as CalendarEvent);
      }
      current = null;
    } else if (current) {
      if (line.startsWith('SUMMARY:')) {
        current.title = line.slice(8);
      } else if (line.startsWith('DTSTART')) {
        current.start = parseICSDate(line);
      } else if (line.startsWith('DTEND')) {
        current.end = parseICSDate(line);
      } else if (line.startsWith('LOCATION:')) {
        current.location = line.slice(9);
      } else if (line.startsWith('DESCRIPTION:')) {
        current.description = line.slice(12);
      }
    }
  }

  // Save to database
  const db = getDb();
  const insert = db.prepare(
    'INSERT OR REPLACE INTO calendar_events (id, title, start, end, location, description, is_fixed, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))'
  );

  for (const event of events) {
    insert.run(event.id, event.title, event.start, event.end, event.location || null, event.description || null, 1, 'ical');
  }

  return events;
}

function parseICSDate(line: string): string {
  // Handle DTSTART;TZID=...:20240115T090000 or DTSTART:20240115T090000Z
  const colonIndex = line.lastIndexOf(':');
  const dateStr = line.slice(colonIndex + 1);

  if (dateStr.length >= 15) {
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    const hour = dateStr.slice(9, 11);
    const min = dateStr.slice(11, 13);
    const sec = dateStr.slice(13, 15);
    return `${year}-${month}-${day}T${hour}:${min}:${sec}`;
  }

  // Date only
  if (dateStr.length >= 8) {
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    return `${year}-${month}-${day}T00:00:00`;
  }

  return dateStr;
}

// Ingest plain text notes
export function ingestNote(title: string, content: string, tags: string[] = []): Note {
  const db = getDb();
  const note: Note = {
    id: uuid(),
    title,
    content,
    tags,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.prepare(
    'INSERT INTO notes (id, title, content, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(note.id, note.title, note.content, JSON.stringify(note.tags), note.createdAt, note.updatedAt);

  return note;
}

// Ingest gratitude list
export function ingestGratitude(items: string[], date?: string): GratitudeEntry {
  const db = getDb();
  const entry: GratitudeEntry = {
    id: uuid(),
    date: date || new Date().toISOString().split('T')[0],
    items,
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    'INSERT INTO gratitude_entries (id, date, items, created_at) VALUES (?, ?, ?, ?)'
  ).run(entry.id, entry.date, JSON.stringify(entry.items), entry.createdAt);

  return entry;
}

// Ingest files from a directory
export function ingestDirectory(dirPath: string): { notes: Note[]; events: CalendarEvent[] } {
  const notes: Note[] = [];
  const events: CalendarEvent[] = [];

  if (!fs.existsSync(dirPath)) {
    return { notes, events };
  }

  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) continue;

    const ext = path.extname(file).toLowerCase();
    const content = fs.readFileSync(fullPath, 'utf-8');

    if (ext === '.ics' || ext === '.ical') {
      events.push(...ingestICS(content));
    } else if (ext === '.md' || ext === '.txt') {
      notes.push(ingestNote(path.basename(file, ext), content, ['imported']));
    }
  }

  return { notes, events };
}

// Add a manual calendar event
export function addCalendarEvent(
  title: string, start: string, end: string,
  options?: { location?: string; description?: string; isFixed?: boolean }
): CalendarEvent {
  const db = getDb();
  const event: CalendarEvent = {
    id: uuid(),
    title,
    start,
    end,
    location: options?.location,
    description: options?.description,
    isFixed: options?.isFixed ?? true,
    source: 'manual',
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    'INSERT INTO calendar_events (id, title, start, end, location, description, is_fixed, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(event.id, event.title, event.start, event.end, event.location || null, event.description || null, event.isFixed ? 1 : 0, event.source, event.createdAt);

  return event;
}

// Get events for a date
export function getEventsForDate(date: string): CalendarEvent[] {
  return getDb().prepare(
    'SELECT id, title, start, end, location, description, is_fixed as isFixed, source, created_at as createdAt FROM calendar_events WHERE date(start) = ? ORDER BY start'
  ).all(date) as CalendarEvent[];
}

// Get all notes
export function getNotes(limit: number = 50): Note[] {
  return getDb().prepare(
    'SELECT id, title, content, tags, created_at as createdAt, updated_at as updatedAt FROM notes ORDER BY updated_at DESC LIMIT ?'
  ).all(limit) as Note[];
}

// Get gratitude entries
export function getGratitudeEntries(limit: number = 7): GratitudeEntry[] {
  return getDb().prepare(
    'SELECT id, date, items, created_at as createdAt FROM gratitude_entries ORDER BY date DESC LIMIT ?'
  ).all(limit) as GratitudeEntry[];
}

// Add a task
export function addTask(
  title: string,
  options?: { category?: string; priority?: 'high' | 'medium' | 'low'; estimatedMinutes?: number; dueDate?: string; notes?: string }
) {
  const db = getDb();
  const id = uuid();
  db.prepare(
    'INSERT INTO tasks (id, title, category, priority, estimated_minutes, due_date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))'
  ).run(id, title, options?.category || 'general', options?.priority || 'medium', options?.estimatedMinutes || null, options?.dueDate || null, options?.notes || null);

  return { id, title, category: options?.category || 'general', priority: options?.priority || 'medium' };
}

// Get incomplete tasks
export function getIncompleteTasks() {
  return getDb().prepare(
    'SELECT id, title, category, priority, estimated_minutes as estimatedMinutes, due_date as dueDate, notes, created_at as createdAt FROM tasks WHERE completed = 0 ORDER BY CASE priority WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 WHEN \'low\' THEN 3 END'
  ).all();
}
