import { NextResponse } from 'next/server';
import { admin, userFrom } from '@/lib/server';
import { live } from '@/lib/value';
const PACKS = { sirens: { cost: 100, w: [70, 25, 5, 0], kind: 'player' }, poseidon: { cost: 250, w: [35, 40, 20, 5] }, scroll: { cost: 300, w: [40, 35, 20, 5], kind: 'event' } };
export async function POST(req) {
  const user = await userFrom(req);
  if (!user) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  const { pack } = await req.json();
  const pk = PACKS[pack];
  if (!pk) return NextResponse.json({ error: 'Bad pack' }, { status: 400 });
  const db = admin();
  const { data: p } = await db.from('profiles').select('drachmas').eq('id', user.id).single();
  if (!p || p.drachmas < pk.cost) return NextResponse.json({ error: 'Not enough drachmas' }, { status: 400 });
  const { data: all } = await db.from('cards').select('*');
  const pool = all.filter(c => live(c) && (!pk.kind || c.kind === pk.kind));
  const pulled = [];
  for (let i = 0; i < 3; i++) {
    let x = Math.random() * 100, r = 0, s = 0;
    for (let j = 0; j < 4; j++) { s += pk.w[j]; if (x < s) { r = j; break; } }
    let g = pool.filter(c => c.rarity === r); if (!g.length) g = pool;
    pulled.push(g[Math.random() * g.length | 0]);
  }
  await db.from('profiles').update({ drachmas: p.drachmas - pk.cost }).eq('id', user.id);
  await db.from('inventory').insert(pulled.map(c => ({ user_id: user.id, card_id: c.id })));
  return NextResponse.json({ pulled });
}
