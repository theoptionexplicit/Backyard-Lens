import { NextRequest, NextResponse } from 'next/server';
import { generateDailyPlan, redistributeAfterCompletion, getPlanForDate } from '@/lib/planner';

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date') || new Date().toISOString().split('T')[0];
  const blocks = getPlanForDate(date);
  return NextResponse.json({ date, blocks });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { date, taskIds } = body;
  const planDate = date || new Date().toISOString().split('T')[0];
  const blocks = generateDailyPlan(planDate, taskIds);
  return NextResponse.json({ date: planDate, blocks });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { date, completedBlockId } = body;
  if (!date || !completedBlockId) {
    return NextResponse.json({ error: 'date and completedBlockId required' }, { status: 400 });
  }
  const blocks = redistributeAfterCompletion(date, completedBlockId);
  return NextResponse.json({ date, blocks });
}
