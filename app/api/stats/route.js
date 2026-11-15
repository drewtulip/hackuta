import { NextResponse } from 'next/server';
import { admin } from '@/lib/server';
// HOOK FOR THE STATS DATABASE. Your CE teammate's pipeline POSTs:
// [{ "card_id": "p_alpha", "avg_score": 63, "kd": 1.32 }, ...]  with header x-ingest-key: <INGEST_KEY>
export async function POST(req) {
  if (req.headers.get('x-ingest-key') !== process.env.INGEST_KEY) return NextResponse.json({ error: 'Forbidden' }, { status: 401 });
  const rows = await req.json();
  const { error } = await admin().from('card_stats').upsert(rows.map(r => ({ card_id: r.card_id, avg_score: r.avg_score, kd: r.kd, updated_at: new Date().toISOString() })));
  return NextResponse.json(error ? { error: error.message } : { ok: true, updated: rows.length });
}
