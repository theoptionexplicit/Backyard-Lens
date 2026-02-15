import { NextRequest, NextResponse } from 'next/server';
import { getAllSettings, setSetting } from '@/lib/db';

export async function GET() {
  return NextResponse.json(getAllSettings());
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  for (const [key, value] of Object.entries(body)) {
    setSetting(key, String(value));
  }
  return NextResponse.json(getAllSettings());
}
