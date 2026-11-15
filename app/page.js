'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { RARITY, value, live } from '@/lib/value';

const APP_NAME = 'Odyssey Cards'; // change this once you pick a name
const PACKS = [['sirens', 'Sirens’ Chest (players)', 100], ['poseidon', 'Poseidon’s Tide (mixed)', 250], ['scroll', 'Event Scroll (events)', 300]];

export default function Home() {
  const [session, setSession] = useState(null), [tab, setTab] = useState('shop'), [msg, setMsg] = useState(''), [pulled, setPulled] = useState([]);
  const [d, setD] = useState({ cards: [], profiles: [], inv: [] }), [f, setF] = useState({ email: '', pw: '', name: '' }), [q, setQ] = useState(''), [ans, setAns] = useState('');
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => l.subscription.unsubscribe();
  }, []);
  const load = async () => {
    const [c, p, i] = await Promise.all([supabase.from('cards').select('*, card_stats(*)'), supabase.from('profiles').select('*'), supabase.from('inventory').select('*')]);
    setD({ cards: c.data || [], profiles: p.data || [], inv: i.data || [] });
  };
  useEffect(() => { if (session) load(); }, [session]);

  const auth = async up => {
    const { error } = up ? await supabase.auth.signUp({ email: f.email, password: f.pw, options: { data: { username: f.name } } })
      : await supabase.auth.signInWithPassword({ email: f.email, password: f.pw });
    setMsg(error ? error.message : '');
  };
  const api = async (path, body) => (await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify(body) })).json();
  const buy = async pack => { const r = await api('/api/buy', { pack }); if (r.error) return setMsg(r.error); setPulled(r.pulled); setMsg(''); load(); };

  // Streams Athena's answer word by word from /api/oracle
  const ask = async () => {
    if (!q.trim() || asking) return;
    setAsking(true); setAns('Athena considers your question...');
    try {
      const r = await fetch('/api/oracle', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token }, body: JSON.stringify({ question: q }) });
      if (!r.ok || !r.body) { setAns((await r.text()) || 'Athena is silent.'); setAsking(false); return; }
      const reader = r.body.getReader(), dec = new TextDecoder();
      let text = ''; setAns('');
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        text += dec.decode(chunk, { stream: true });
        setAns(text);
      }
    } catch (e) { setAns('Athena could not be reached.'); }
    setAsking(false);
  };

  if (!session) return (<main><h1>{APP_NAME}</h1>
    <input placeholder="Username (sign up)" onChange={e => setF({ ...f, name: e.target.value })} />
    <input placeholder="Email" onChange={e => setF({ ...f, email: e.target.value })} />
    <input type="password" placeholder="Password" onChange={e => setF({ ...f, pw: e.target.value })} />
    <p><button className="pri" onClick={() => auth(true)}>Sign up</button><button onClick={() => auth(false)}>Log in</button></p><p>{msg}</p></main>);

  const stat = c => Array.isArray(c.card_stats) ? c.card_stats[0] : c.card_stats;
  const val = c => value(c, stat(c));
  const byId = Object.fromEntries(d.cards.map(c => [c.id, c]));
  const me = d.profiles.find(p => p.id === session.user.id);
  const mine = d.inv.filter(i => i.user_id === session.user.id);
  const worth = p => p.drachmas + d.inv.filter(i => i.user_id === p.id).reduce((s, i) => s + (byId[i.card_id] ? val(byId[i.card_id]) : 0), 0);
  const Card = ({ c }) => (<div className={`card r${c.rarity} v-${c.variant}`}>
    <div className="tag">{RARITY[c.rarity]} · {c.kind}{c.variant !== 'base' ? ' · ' + c.variant : ''}</div><b>{c.name}</b>
    {c.era && <div className="mut">{c.era}</div>}<div>Value: <b>{val(c)}</b></div>
    <div className="mut">Avg {stat(c)?.avg_score ?? '–'} · K/D {stat(c)?.kd ?? '–'}</div></div>);

  return (<main>
    <h1>{APP_NAME}</h1>
    <p>{me?.username} · <b>{me?.drachmas}</b> drachmas <button onClick={() => supabase.auth.signOut()}>Log out</button></p>
    {[['shop', 'Shop'], ['col', 'Collection'], ['lb', 'Leaderboard'], ['athena', 'Ask Athena']].map(t => <button key={t[0]} className={tab === t[0] ? 'on' : ''} onClick={() => { setTab(t[0]); setMsg(''); }}>{t[1]}</button>)}
    <p className="mut">{msg}</p>
    {tab === 'shop' && <><div className="grid">{PACKS.map(p => <div className="card" key={p[0]}><b>{p[1]}</b><p>{p[2]} drachmas</p><button className="pri" onClick={() => buy(p[0])}>Buy &amp; open</button></div>)}</div>
      {pulled.length > 0 && <><h3>You pulled</h3><div className="grid">{pulled.map((c, i) => <Card key={i} c={byId[c.id] || c} />)}</div></>}
      <h3>Limited-time cards (live now)</h3><div className="grid">{d.cards.filter(c => c.variant !== 'base' && live(c)).map(c => <Card key={c.id} c={c} />)}</div></>}
    {tab === 'col' && <div className="grid">{mine.map(i => byId[i.card_id] && <Card key={i.id} c={byId[i.card_id]} />)}</div>}
    {tab === 'lb' && <><h3>Collectors</h3><table><tbody><tr><th>#</th><th>Name</th><th>Cards</th><th>Net worth</th></tr>
      {[...d.profiles].sort((a, b) => worth(b) - worth(a)).map((p, i) => <tr key={p.id}><td>{i + 1}</td><td>{p.username}</td><td>{d.inv.filter(x => x.user_id === p.id).length}</td><td>{worth(p)}</td></tr>)}</tbody></table>
      <h3>Cards by Fate Score</h3><table><tbody><tr><th>#</th><th>Card</th><th>Rarity</th><th>Avg</th><th>K/D</th><th>Value</th></tr>
      {[...d.cards].sort((a, b) => val(b) - val(a)).map((c, i) => <tr key={c.id}><td>{i + 1}</td><td>{c.name}</td><td>{RARITY[c.rarity]}</td><td>{stat(c)?.avg_score}</td><td>{stat(c)?.kd}</td><td>{val(c)}</td></tr>)}</tbody></table></>}
    {tab === 'athena' && <><h3>Athena, goddess of wisdom</h3>
      <input style={{ width: '70%' }} placeholder="Which card should I buy?" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && ask()} />
      <button className="pri" onClick={ask} disabled={asking}>Ask</button>
      <p style={{ whiteSpace: 'pre-wrap' }}>{ans}</p></>}
  </main>);
}