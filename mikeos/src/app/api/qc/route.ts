import { NextRequest, NextResponse } from 'next/server';
import {
  isQcAvailable,
  getInsightBundle,
  getDailyFeatures,
  getMoodTrend,
  getFeatureRange,
  getStateLabel,
} from '@/lib/quantified-claude';
import { getSetting, setSetting } from '@/lib/db';

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type') || 'bundle';
  const date = searchParams.get('date') || todayStr();

  if (!isQcAvailable()) {
    return NextResponse.json({ available: false });
  }

  switch (type) {
    case 'bundle': {
      const bundle = getInsightBundle(date);

      if (bundle.stateLabel) {
        const label = bundle.stateLabel.label;
        if (label === 'acute' || label === 'onset') {
          const current = getSetting('lowFrictionMode');
          if (current !== 'true') {
            setSetting('lowFrictionMode', 'true');
            setSetting('lowFrictionAutoEnabled', 'true');
          }
        } else {
          const autoEnabled = getSetting('lowFrictionAutoEnabled');
          if (autoEnabled === 'true') {
            setSetting('lowFrictionMode', 'false');
            setSetting('lowFrictionAutoEnabled', 'false');
          }
        }
      }

      return NextResponse.json(bundle);
    }

    case 'features': {
      return NextResponse.json(getDailyFeatures(date));
    }

    case 'trend': {
      const days = parseInt(searchParams.get('days') || '14', 10);
      return NextResponse.json(getMoodTrend(date, days));
    }

    case 'range': {
      const end = searchParams.get('end') || date;
      return NextResponse.json(getFeatureRange(date, end));
    }

    case 'state': {
      return NextResponse.json(getStateLabel(date));
    }

    case 'status': {
      return NextResponse.json({ available: isQcAvailable() });
    }

    default:
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  }
}
