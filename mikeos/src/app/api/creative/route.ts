import { NextRequest, NextResponse } from 'next/server';
import { createProject, updateProject, getProjects, getProject, getDailyPrompt, shipProject, deleteProject } from '@/lib/creative';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  const status = request.nextUrl.searchParams.get('status');
  const prompt = request.nextUrl.searchParams.get('prompt');

  if (prompt) {
    const type = request.nextUrl.searchParams.get('type') as 'art' | 'music' | 'writing' | 'code' | undefined;
    return NextResponse.json(getDailyPrompt(type || undefined));
  }

  if (id) {
    const project = getProject(id);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(project);
  }

  return NextResponse.json(getProjects(status || undefined));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { title, type, description } = body;
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });
  const project = createProject(title, type || 'other', description);
  return NextResponse.json(project);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  if (updates.action === 'ship') {
    const project = shipProject(id);
    return NextResponse.json(project);
  }

  const project = updateProject(id, updates);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(project);
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  deleteProject(id);
  return NextResponse.json({ success: true });
}
