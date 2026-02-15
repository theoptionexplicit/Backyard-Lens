import { NextRequest, NextResponse } from 'next/server';
import {
  logMeal, logSymptom, logMed, logMood, logSleep,
  getDailyCalories, getWeeklyTrends, getHealthEntriesForDate,
  getMoodForDate, getSleepForDate
} from '@/lib/health';

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date') || new Date().toISOString().split('T')[0];
  const type = request.nextUrl.searchParams.get('type');

  if (type === 'trends') {
    const weekStart = request.nextUrl.searchParams.get('weekStart') || date;
    return NextResponse.json(getWeeklyTrends(weekStart));
  }

  if (type === 'calories') {
    return NextResponse.json(getDailyCalories(date));
  }

  if (type === 'mood') {
    return NextResponse.json(getMoodForDate(date));
  }

  if (type === 'sleep') {
    return NextResponse.json(getSleepForDate(date));
  }

  const entries = getHealthEntriesForDate(date);
  const mood = getMoodForDate(date);
  const sleep = getSleepForDate(date);
  const calories = getDailyCalories(date);

  return NextResponse.json({ date, entries, mood, sleep, calories });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type, date } = body;

  switch (type) {
    case 'meal':
      return NextResponse.json(logMeal(body.value, date));
    case 'symptom':
      return NextResponse.json(logSymptom(body.value, date));
    case 'med':
      return NextResponse.json(logMed(body.value, date));
    case 'mood':
      return NextResponse.json(logMood(body.mood, body.energy, body.anxiety, body.notes, date));
    case 'sleep':
      return NextResponse.json(logSleep(body.hours, body.quality, body.bedtime, body.wakeTime, body.notes, date));
    default:
      return NextResponse.json({ error: 'Unknown health entry type' }, { status: 400 });
  }
}
