import { v4 as uuid } from 'uuid';
import { getDb } from './db';
import type { CreativeProject } from '@/types';

const CREATIVE_PROMPTS = {
  art: [
    'Draw something using only 3 colors',
    'Sketch the view from your window right now',
    'Create a self-portrait in under 10 minutes',
    'Make something inspired by the last song you heard',
    'Collage from whatever paper is nearby',
    'Draw with your non-dominant hand',
    'Create art from a single continuous line',
    'Make something using only geometric shapes',
  ],
  music: [
    'Record a 30-second loop with whatever\'s around you',
    'Write a 4-chord progression and hum a melody over it',
    'Sample a sound from your environment and build a beat',
    'Write lyrics about what you see right now',
    'Play something in a key you never use',
    'Cover 30 seconds of a song you love, but change the mood',
    'Create a sound texture — no melody, just atmosphere',
    'Write a bassline first, then build up',
  ],
  writing: [
    'Write 200 words about a memory from this morning',
    'Describe a stranger you saw today in vivid detail',
    'Write a letter you\'ll never send',
    'List 10 things you noticed today that others probably didn\'t',
    'Write the opening paragraph of a story set in your current location',
    'Rewrite a mundane event as if it were epic fiction',
    'Write a poem using only words from today\'s headlines',
    'Describe your current mood as a weather report',
  ],
  code: [
    'Build something useful in under 50 lines',
    'Automate one thing you did manually today',
    'Create a generative art piece with code',
    'Build a tool that solves a problem only you have',
    'Refactor the ugliest code you can find',
    'Write code that produces music or sound',
  ],
};

const CONSTRAINTS = [
  'Complete in under 30 minutes',
  'Use only what\'s within arm\'s reach',
  'No undoing — first draft is final',
  'Make it ugly on purpose, then find what works',
  'Collaborate with randomness (dice, shuffle, coin flip)',
  'Start from the middle, not the beginning',
  'Set a timer: 15 minutes, then stop',
  'Make the smallest possible version first',
];

export function createProject(title: string, type: CreativeProject['type'], description?: string): CreativeProject {
  const db = getDb();
  const project: CreativeProject = {
    id: uuid(),
    title,
    type,
    status: 'idea',
    description,
    assets: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.prepare(
    'INSERT INTO creative_projects (id, title, type, status, description, assets, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(project.id, project.title, project.type, project.status, project.description || null, '[]', project.createdAt, project.updatedAt);

  return project;
}

export function updateProject(id: string, updates: Partial<CreativeProject>): CreativeProject | null {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM creative_projects WHERE id = ?').get(id) as Record<string, string> | undefined;
  if (!existing) return null;

  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.notes !== undefined) { fields.push('notes = ?'); values.push(updates.notes); }
  if (updates.prompt !== undefined) { fields.push('prompt = ?'); values.push(updates.prompt); }
  if (updates.assets !== undefined) { fields.push('assets = ?'); values.push(JSON.stringify(updates.assets)); }

  fields.push('updated_at = datetime(\'now\')');
  values.push(id);

  db.prepare(`UPDATE creative_projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return db.prepare('SELECT * FROM creative_projects WHERE id = ?').get(id) as CreativeProject;
}

export function getProjects(status?: string): CreativeProject[] {
  const db = getDb();
  if (status) {
    return db.prepare(
      'SELECT id, title, type, status, description, notes, assets, prompt, created_at as createdAt, updated_at as updatedAt FROM creative_projects WHERE status = ? ORDER BY updated_at DESC'
    ).all(status) as CreativeProject[];
  }
  return db.prepare(
    'SELECT id, title, type, status, description, notes, assets, prompt, created_at as createdAt, updated_at as updatedAt FROM creative_projects ORDER BY updated_at DESC'
  ).all() as CreativeProject[];
}

export function getProject(id: string): CreativeProject | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT id, title, type, status, description, notes, assets, prompt, created_at as createdAt, updated_at as updatedAt FROM creative_projects WHERE id = ?'
  ).get(id);
  return (row as CreativeProject) || null;
}

export function getDailyPrompt(type?: CreativeProject['type']): { prompt: string; constraint: string } {
  const day = new Date().getDate();
  const t = type || (['art', 'music', 'writing', 'code'] as const)[day % 4];
  const prompts = CREATIVE_PROMPTS[t as keyof typeof CREATIVE_PROMPTS] || CREATIVE_PROMPTS.writing;
  return {
    prompt: prompts[day % prompts.length],
    constraint: CONSTRAINTS[day % CONSTRAINTS.length],
  };
}

export function shipProject(id: string): CreativeProject | null {
  return updateProject(id, { status: 'shipped' });
}

export function deleteProject(id: string): boolean {
  const result = getDb().prepare('DELETE FROM creative_projects WHERE id = ?').run(id);
  return result.changes > 0;
}
