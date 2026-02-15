import { NextRequest, NextResponse } from 'next/server';
import { exportToJSON, exportToCSV, exportToMarkdown, exportPlanToICS, EXPORTABLE_TABLES } from '@/lib/export';

export async function GET(request: NextRequest) {
  const table = request.nextUrl.searchParams.get('table');
  const format = request.nextUrl.searchParams.get('format') || 'json';
  const date = request.nextUrl.searchParams.get('date');

  if (!table && format === 'ics' && date) {
    const ics = exportPlanToICS(date);
    return new NextResponse(ics, {
      headers: {
        'Content-Type': 'text/calendar',
        'Content-Disposition': `attachment; filename="mikeos-plan-${date}.ics"`,
      },
    });
  }

  if (!table) {
    return NextResponse.json({ tables: EXPORTABLE_TABLES, formats: ['json', 'csv', 'markdown'] });
  }

  if (!EXPORTABLE_TABLES.includes(table)) {
    return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
  }

  switch (format) {
    case 'csv': {
      const csv = exportToCSV(table);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="mikeos-${table}.csv"`,
        },
      });
    }
    case 'markdown': {
      const md = exportToMarkdown(table);
      return new NextResponse(md, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="mikeos-${table}.md"`,
        },
      });
    }
    default: {
      const json = exportToJSON(table);
      return new NextResponse(json, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="mikeos-${table}.json"`,
        },
      });
    }
  }
}
