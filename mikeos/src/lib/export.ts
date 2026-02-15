import { getDb } from './db';

export function exportToJSON(table: string): string {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM ${table} ORDER BY rowid DESC`).all();
  return JSON.stringify(rows, null, 2);
}

export function exportToCSV(table: string): string {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM ${table} ORDER BY rowid DESC`).all() as Record<string, unknown>[];

  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const csvLines = [headers.join(',')];

  for (const row of rows) {
    const values = headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csvLines.push(values.join(','));
  }

  return csvLines.join('\n');
}

export function exportToMarkdown(table: string): string {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM ${table} ORDER BY rowid DESC`).all() as Record<string, unknown>[];

  if (rows.length === 0) return `# ${table}\n\nNo data yet.\n`;

  const headers = Object.keys(rows[0]);
  const lines: string[] = [
    `# ${table}\n`,
    '| ' + headers.join(' | ') + ' |',
    '| ' + headers.map(() => '---').join(' | ') + ' |',
  ];

  for (const row of rows) {
    const values = headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      return String(val).replace(/\|/g, '\\|').replace(/\n/g, ' ');
    });
    lines.push('| ' + values.join(' | ') + ' |');
  }

  return lines.join('\n') + '\n';
}

export function exportPlanToICS(date: string): string {
  const db = getDb();
  const blocks = db.prepare(
    'SELECT * FROM plan_blocks WHERE plan_date = ? ORDER BY start_time'
  ).all(date) as Array<{
    id: string; plan_date: string; title: string;
    start_time: string; end_time: string; type: string;
  }>;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MikeOS//Daily Plan//EN',
    'CALSCALE:GREGORIAN',
  ];

  for (const block of blocks) {
    const dateClean = block.plan_date.replace(/-/g, '');
    const startClean = block.start_time.replace(/:/g, '') + '00';
    const endClean = block.end_time.replace(/:/g, '') + '00';

    lines.push(
      'BEGIN:VEVENT',
      `UID:${block.id}@mikeos`,
      `DTSTART:${dateClean}T${startClean}`,
      `DTEND:${dateClean}T${endClean}`,
      `SUMMARY:${block.title}`,
      `DESCRIPTION:Type: ${block.type}`,
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export const EXPORTABLE_TABLES = [
  'tasks',
  'calendar_events',
  'plan_blocks',
  'health_entries',
  'mood_entries',
  'sleep_entries',
  'relationship_actions',
  'creative_projects',
  'gratitude_entries',
  'notes',
  'automation_tasks',
  'settings',
];
