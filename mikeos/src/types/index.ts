// MikeOS Core Types

export interface Settings {
  wakeTime: string; // HH:MM
  endTime: string; // HH:MM
  lowFrictionMode: boolean;
  veronicaName: string;
  bilingual: boolean; // English + Spanish
  dailyCalorieTarget: number;
  mealLoggingEnabled: boolean;
  healthCheckInsEnabled: boolean;
  creativeMode: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO datetime
  end: string;
  location?: string;
  description?: string;
  isFixed: boolean;
  source: 'manual' | 'ical' | 'ingest';
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  estimatedMinutes?: number;
  completed: boolean;
  completedAt?: string;
  dueDate?: string;
  notes?: string;
  createdAt: string;
}

export interface PlanBlock {
  id: string;
  planDate: string; // YYYY-MM-DD
  taskId?: string;
  eventId?: string;
  title: string;
  start: string; // HH:MM
  end: string; // HH:MM
  type: 'fixed' | 'distributed' | 'break';
  completed: boolean;
  completedAt?: string;
}

export interface DailyPlan {
  date: string;
  blocks: PlanBlock[];
  lowFrictionMode: boolean;
  generatedAt: string;
}

export interface HealthEntry {
  id: string;
  date: string;
  type: 'meal' | 'mood' | 'sleep' | 'med' | 'symptom' | 'weight';
  value: string; // flexible: "eggs and toast ~350cal" or "7/10" or "7.5hrs"
  calories?: number;
  notes?: string;
  createdAt: string;
}

export interface MoodEntry {
  id: string;
  date: string;
  mood: number; // 1-10
  energy: number; // 1-10
  anxiety: number; // 1-10
  notes?: string;
  createdAt: string;
}

export interface SleepEntry {
  id: string;
  date: string;
  hours: number;
  quality: number; // 1-10
  bedtime?: string;
  wakeTime?: string;
  notes?: string;
  createdAt: string;
}

export interface RelationshipAction {
  id: string;
  date: string;
  person: string;
  action: string;
  messageDraft?: string;
  messageDraftEs?: string; // Spanish version
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

export interface CreativeProject {
  id: string;
  title: string;
  type: 'art' | 'music' | 'writing' | 'code' | 'other';
  status: 'idea' | 'in_progress' | 'review' | 'shipped';
  description?: string;
  notes?: string;
  assets: string[]; // file paths
  prompt?: string; // creative prompt/constraint
  createdAt: string;
  updatedAt: string;
}

export interface GratitudeEntry {
  id: string;
  date: string;
  items: string[];
  createdAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyTrend {
  weekStart: string;
  avgMood: number;
  avgEnergy: number;
  avgSleep: number;
  totalCalories: number;
  avgCalories: number;
  symptomsCount: number;
  tasksCompleted: number;
  correlations: string[];
}

export interface AutomationTask {
  id: string;
  title: string;
  type: 'file_cleanup' | 'invoice' | 'receipt' | 'browser' | 'custom';
  description: string;
  command?: string;
  schedule?: string; // cron-like
  lastRun?: string;
  enabled: boolean;
  createdAt: string;
}

export type LowFrictionStep = {
  id: string;
  text: string;
  timeMinutes: number;
  completed: boolean;
};
