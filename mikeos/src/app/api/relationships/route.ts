import { NextRequest, NextResponse } from 'next/server';
import { generateDailyAction, completeAction, getActionsForDate, getRecentActions } from '@/lib/relationships';

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date');
  const recent = request.nextUrl.searchParams.get('recent');

  if (recent) {
    return NextResponse.json(getRecentActions(parseInt(recent) || 7));
  }

  const d = date || new Date().toISOString().split('T')[0];
  const actions = getActionsForDate(d);

  if (actions.length === 0) {
    // Auto-generate today's action
    const action = generateDailyAction(d);
    return NextResponse.json([action]);
  }

  return NextResponse.json(actions);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { date, person } = body;
  const d = date || new Date().toISOString().split('T')[0];
  const action = generateDailyAction(d, person);
  return NextResponse.json(action);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }
  completeAction(id);
  return NextResponse.json({ success: true });
}
