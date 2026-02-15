import { NextRequest, NextResponse } from 'next/server';
import {
  ingestICS, ingestNote, ingestGratitude,
  addCalendarEvent, getEventsForDate, getNotes,
  getGratitudeEntries, addTask, getIncompleteTasks
} from '@/lib/ingest';

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type');
  const date = request.nextUrl.searchParams.get('date') || new Date().toISOString().split('T')[0];

  switch (type) {
    case 'events':
      return NextResponse.json(getEventsForDate(date));
    case 'notes':
      return NextResponse.json(getNotes());
    case 'gratitude':
      return NextResponse.json(getGratitudeEntries());
    case 'tasks':
      return NextResponse.json(getIncompleteTasks());
    default:
      return NextResponse.json({
        events: getEventsForDate(date),
        tasks: getIncompleteTasks(),
        notes: getNotes(10),
        gratitude: getGratitudeEntries(3),
      });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type } = body;

  switch (type) {
    case 'ics':
      return NextResponse.json(ingestICS(body.content));
    case 'note':
      return NextResponse.json(ingestNote(body.title, body.content, body.tags));
    case 'gratitude':
      return NextResponse.json(ingestGratitude(body.items, body.date));
    case 'event':
      return NextResponse.json(addCalendarEvent(body.title, body.start, body.end, {
        location: body.location,
        description: body.description,
        isFixed: body.isFixed,
      }));
    case 'task':
      return NextResponse.json(addTask(body.title, {
        category: body.category,
        priority: body.priority,
        estimatedMinutes: body.estimatedMinutes,
        dueDate: body.dueDate,
        notes: body.notes,
      }));
    default:
      return NextResponse.json({ error: 'Unknown ingest type' }, { status: 400 });
  }
}
