import { NextRequest, NextResponse } from 'next/server';
import { getAutomationTasks, createAutomation, toggleAutomation, runAutomation, deleteAutomation } from '@/lib/automation';

export async function GET() {
  return NextResponse.json(getAutomationTasks());
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (body.action === 'run') {
    const result = runAutomation(body.id);
    return NextResponse.json(result);
  }

  if (body.action === 'toggle') {
    toggleAutomation(body.id);
    return NextResponse.json({ success: true });
  }

  const { title, type, description } = body;
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });
  const task = createAutomation(title, type || 'custom', description || '');
  return NextResponse.json(task);
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  deleteAutomation(id);
  return NextResponse.json({ success: true });
}
