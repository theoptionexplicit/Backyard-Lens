import type { LowFrictionStep, Task } from '@/types';
import { v4 as uuid } from 'uuid';

// Break any task into tiny, gentle steps for bad brain days
export function decompose(task: Task): LowFrictionStep[] {
  const steps: LowFrictionStep[] = [];

  // Universal tiny first step
  steps.push({
    id: uuid(),
    text: `Open/find what you need for "${task.title}"`,
    timeMinutes: 2,
    completed: false,
  });

  // Category-specific breakdowns
  const category = task.category?.toLowerCase() || '';
  const title = task.title.toLowerCase();

  if (category === 'writing' || title.includes('write') || title.includes('draft')) {
    steps.push(
      { id: uuid(), text: 'Write just one sentence. Any sentence.', timeMinutes: 3, completed: false },
      { id: uuid(), text: 'Write one more sentence that connects to it.', timeMinutes: 3, completed: false },
      { id: uuid(), text: 'Read what you have. Change one word.', timeMinutes: 2, completed: false },
      { id: uuid(), text: 'Keep going for 5 more minutes or stop here. Both are fine.', timeMinutes: 5, completed: false },
    );
  } else if (category === 'art' || title.includes('draw') || title.includes('paint') || title.includes('sketch')) {
    steps.push(
      { id: uuid(), text: 'Pick up one tool. Just hold it.', timeMinutes: 1, completed: false },
      { id: uuid(), text: 'Make one mark. It doesn\'t have to be good.', timeMinutes: 2, completed: false },
      { id: uuid(), text: 'Make five more marks around the first one.', timeMinutes: 3, completed: false },
      { id: uuid(), text: 'Step back and look. What do you see?', timeMinutes: 2, completed: false },
      { id: uuid(), text: 'Keep going or call it done. No wrong answer.', timeMinutes: 5, completed: false },
    );
  } else if (category === 'music' || title.includes('music') || title.includes('song') || title.includes('record')) {
    steps.push(
      { id: uuid(), text: 'Open your DAW or pick up your instrument.', timeMinutes: 2, completed: false },
      { id: uuid(), text: 'Play one chord or one note. Listen to it.', timeMinutes: 2, completed: false },
      { id: uuid(), text: 'Play a second thing that sounds good next to it.', timeMinutes: 3, completed: false },
      { id: uuid(), text: 'Loop something for 2 minutes. Just listen.', timeMinutes: 3, completed: false },
      { id: uuid(), text: 'Add one more element or stop here.', timeMinutes: 5, completed: false },
    );
  } else if (title.includes('clean') || title.includes('organize') || title.includes('tidy')) {
    steps.push(
      { id: uuid(), text: 'Pick up one thing and put it away.', timeMinutes: 1, completed: false },
      { id: uuid(), text: 'Pick up three more things.', timeMinutes: 3, completed: false },
      { id: uuid(), text: 'Clear one surface completely.', timeMinutes: 5, completed: false },
      { id: uuid(), text: 'Good enough. You did something.', timeMinutes: 0, completed: false },
    );
  } else if (title.includes('email') || title.includes('respond') || title.includes('reply')) {
    steps.push(
      { id: uuid(), text: 'Open the email/message. Just read it.', timeMinutes: 2, completed: false },
      { id: uuid(), text: 'Type "Hi" or the person\'s name. That\'s your start.', timeMinutes: 1, completed: false },
      { id: uuid(), text: 'Write one sentence answering their main question.', timeMinutes: 3, completed: false },
      { id: uuid(), text: 'Add a closing line and send it. Done.', timeMinutes: 2, completed: false },
    );
  } else {
    // Generic decomposition
    steps.push(
      { id: uuid(), text: 'Spend 2 minutes just looking at what needs to happen.', timeMinutes: 2, completed: false },
      { id: uuid(), text: 'Do the smallest possible piece of it.', timeMinutes: 5, completed: false },
      { id: uuid(), text: 'Do one more small piece.', timeMinutes: 5, completed: false },
      { id: uuid(), text: 'Check in: keep going or take a break?', timeMinutes: 1, completed: false },
    );
  }

  return steps;
}

// Generate a gentle daily plan for bad brain days
export function gentlePlan(): {
  greeting: string;
  steps: LowFrictionStep[];
  reminder: string;
} {
  const greetings = [
    'Hey. Rough day? That\'s okay. Here\'s a gentle plan.',
    'Low energy is valid. Let\'s keep it simple today.',
    'Not every day has to be productive. But let\'s try a few small things.',
    'Today we\'re going easy. No pressure, just tiny steps.',
    'Brain fog? Let\'s work with what we\'ve got.',
  ];

  const steps: LowFrictionStep[] = [
    { id: uuid(), text: 'Drink a glass of water.', timeMinutes: 1, completed: false },
    { id: uuid(), text: 'Step outside or open a window for 2 minutes.', timeMinutes: 2, completed: false },
    { id: uuid(), text: 'Pick ONE thing from your task list. The easiest one.', timeMinutes: 1, completed: false },
    { id: uuid(), text: 'Work on it for 10 minutes. Set a timer.', timeMinutes: 10, completed: false },
    { id: uuid(), text: 'Take a break. Stretch or breathe.', timeMinutes: 5, completed: false },
    { id: uuid(), text: 'Do one more small task if you feel like it.', timeMinutes: 10, completed: false },
    { id: uuid(), text: 'Send one kind message to someone.', timeMinutes: 3, completed: false },
    { id: uuid(), text: 'Write down one good thing about today.', timeMinutes: 2, completed: false },
  ];

  const reminders = [
    'You don\'t have to do all of these. Even one is enough.',
    'Progress isn\'t always visible. You\'re doing better than you think.',
    'Some days the win is just getting through. That counts.',
    'Be kind to yourself. Tomorrow is another chance.',
  ];

  const day = new Date().getDate();
  return {
    greeting: greetings[day % greetings.length],
    steps,
    reminder: reminders[day % reminders.length],
  };
}
