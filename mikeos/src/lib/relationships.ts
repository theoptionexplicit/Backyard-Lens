import { v4 as uuid } from 'uuid';
import { getDb, getSetting } from './db';
import type { RelationshipAction } from '@/types';

// Loving action templates — small, specific, doable
const LOVING_ACTIONS = {
  partner: [
    { action: 'Send a good morning text', template: 'Good morning beautiful. Thinking of you today.', templateEs: 'Buenos días hermosa. Pensando en ti hoy.' },
    { action: 'Share something that reminded you of her', template: 'This made me think of you — {detail}', templateEs: 'Esto me hizo pensar en ti — {detail}' },
    { action: 'Ask about her day with a specific question', template: 'How did {thing} go today? I was curious.', templateEs: '¿Cómo te fue con {thing} hoy? Tenía curiosidad.' },
    { action: 'Send a voice note telling her one thing you appreciate', template: '[Voice note: one thing you appreciate about her today]', templateEs: '[Nota de voz: una cosa que aprecias de ella hoy]' },
    { action: 'Plan a small surprise for this week', template: 'Hey, I have a little idea for us this week...', templateEs: 'Oye, tengo una pequeña idea para nosotros esta semana...' },
    { action: 'Share a photo of something beautiful you saw', template: 'Saw this and wanted to share it with you.', templateEs: 'Vi esto y quería compartirlo contigo.' },
    { action: 'Tell her something specific you love about her', template: 'You know what I love about you? {specific_thing}', templateEs: '¿Sabes qué amo de ti? {specific_thing}' },
    { action: 'Send a song that fits your mood about her', template: 'This song = how I feel about you right now 🎵', templateEs: 'Esta canción = cómo me siento por ti ahora 🎵' },
    { action: 'Ask if there\'s anything you can help with', template: 'Is there anything on your plate I can help with? Even small stuff.', templateEs: '¿Hay algo en lo que te pueda ayudar? Incluso cosas pequeñas.' },
    { action: 'Share one thing you\'re grateful for about her', template: 'Just wanted you to know: I\'m grateful for {thing}. That\'s all.', templateEs: 'Solo quería que supieras: estoy agradecido por {thing}. Eso es todo.' },
  ],
  family: [
    { action: 'Call a family member just to check in', template: 'Hey, just calling to say hi and see how you\'re doing.', templateEs: 'Oye, solo llamo para saludar y ver cómo estás.' },
    { action: 'Send a family photo or memory', template: 'Found this and it made me smile. Miss you!', templateEs: '¡Encontré esto y me hizo sonreír. Te extraño!' },
    { action: 'Ask about something specific in their life', template: 'How\'s {thing} going? Been thinking about it.', templateEs: '¿Cómo va {thing}? He estado pensando en eso.' },
    { action: 'Share something good happening in your life', template: 'Wanted to share some good news...', templateEs: 'Quería compartir buenas noticias...' },
  ],
  friends: [
    { action: 'Send a meme or article to a friend', template: 'This is so us 😂', templateEs: 'Esto somos nosotros 😂' },
    { action: 'Check in on a friend you haven\'t talked to recently', template: 'Hey! Haven\'t heard from you in a bit. How\'s everything?', templateEs: '¡Oye! No he sabido de ti. ¿Cómo va todo?' },
    { action: 'Invite someone to do something low-key', template: 'Want to grab coffee/a drink sometime this week?', templateEs: '¿Quieres tomar un café/algo esta semana?' },
  ],
};

export function generateDailyAction(date: string, person?: string): RelationshipAction {
  const db = getDb();
  const veronicaName = getSetting('veronicaName') || 'Veronica';
  const bilingual = getSetting('bilingual') === 'true';

  // Check if there's already an action for today
  const existing = db.prepare(
    'SELECT * FROM relationship_actions WHERE date = ? LIMIT 1'
  ).get(date);

  if (existing) {
    return existing as RelationshipAction;
  }

  // Determine who to focus on — default is partner
  const targetPerson = person || veronicaName;
  let category: 'partner' | 'family' | 'friends' = 'partner';
  if (targetPerson !== veronicaName) {
    // Simple heuristic: rotate between family and friends for non-partner
    const dayOfWeek = new Date(date).getDay();
    category = dayOfWeek % 2 === 0 ? 'family' : 'friends';
  }

  const actions = LOVING_ACTIONS[category];
  // Pick based on day to avoid repeats within a week
  const dayIndex = new Date(date).getDate() % actions.length;
  const chosen = actions[dayIndex];

  const action: RelationshipAction = {
    id: uuid(),
    date,
    person: targetPerson,
    action: chosen.action,
    messageDraft: chosen.template,
    messageDraftEs: bilingual ? chosen.templateEs : undefined,
    completed: false,
    createdAt: new Date().toISOString(),
  };

  db.prepare(
    'INSERT INTO relationship_actions (id, date, person, action, message_draft, message_draft_es, completed, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)'
  ).run(action.id, action.date, action.person, action.action, action.messageDraft, action.messageDraftEs || null, action.createdAt);

  return action;
}

export function completeAction(id: string): void {
  getDb().prepare(
    'UPDATE relationship_actions SET completed = 1, completed_at = datetime(\'now\') WHERE id = ?'
  ).run(id);
}

export function getActionsForDate(date: string): RelationshipAction[] {
  return getDb().prepare(
    'SELECT id, date, person, action, message_draft as messageDraft, message_draft_es as messageDraftEs, completed, completed_at as completedAt, created_at as createdAt FROM relationship_actions WHERE date = ? ORDER BY created_at'
  ).all(date) as RelationshipAction[];
}

export function getRecentActions(limit: number = 7): RelationshipAction[] {
  return getDb().prepare(
    'SELECT id, date, person, action, message_draft as messageDraft, message_draft_es as messageDraftEs, completed, completed_at as completedAt, created_at as createdAt FROM relationship_actions ORDER BY date DESC LIMIT ?'
  ).all(limit) as RelationshipAction[];
}
