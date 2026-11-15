'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const APP_NAME = 'TROJAN HAUL';
const RARITY_CLASS = { Common: 'r0', Rare: 'r1', Epic: 'r2', Legendary: 'r3' };
const GOD_ICON = { Zeus: '⚡', Poseidon: '🌊', Hades: '💀', Ares: '🔥' };

export default function Home() {
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState('shop');
  const [msg, setMsg] = useState('');
  const [pulled, setPulled] = useState([]);
  const [opening, setOpening] = useState(false);
  const [d, setD] = useState({ packs: [], cards: [], variants: [], wallet: null, myCards: [] });
  const [f, setF] = useState({ email: '', pw: '', name: '' });
  const [q, setQ] = useState('');
  const [ans, setAns] = useState('');
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => l.subscription.unsubscribe();
  }, []);

  const load = async (uid) => {
    const userId = uid || session?.user?.id;
    if (!userId) return;

    const [pks, crds, vars, wlt, inv] = await Promise.all([
      supabase.from('packs').select('*').eq('is_active', true).order('price_coins'),
      supabase.from('cards').select('*, players(name, category, image_url)').limit(300),
      supabase.from('card_variants').select('id, card_id, border, finish, rarity, edition, image_url').limit(1500),
      supabase.from('user_wallets').select('*').eq('user_id', userId).maybeSingle(),
      supabase
        .from('user_cards')
        .select('id, acquired_at, is_favorite, card_variants(id, border, finish, rarity, cards(id, card_name, god_form, element, attack, defense, players(name, category, image_url)))')
        .eq('user_id', userId)
        .order('acquired_at', { ascending: false }),
    ]);

    setD({
      packs: pks.data || [],
      cards: crds.data || [],
      variants: vars.data || [],
      wallet: wlt.data || { coins: 1000 },
      myCards: inv.data || [],
    });
  };

  useEffect(() => {
    if (session) load(session.user.id);
  }, [session]);

  const auth = async (up) => {
    const { error } = up
      ? await supabase.auth.signUp({ email: f.email, password: f.pw, options: { data: { username: f.name } } })
      : await supabase.auth.signInWithPassword({ email: f.email, password: f.pw });
    setMsg(error ? error.message : '');
  };

  const buy = async (packId) => {
    if (opening) return;
    setOpening(true);
    setMsg('Opening pack...');
    try {
      const r = await fetch('/api/packs/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.access_token,
        },
        body: JSON.stringify({ packId }),
      }).then((res) => res.json());

      if (r.error) {
        setMsg(r.error);
      } else {
        setMsg('Pack opened! Check your new cards below.');
        await load(session.user.id);
        const { data: latest } = await supabase
          .from('user_cards')
          .select('id, card_variants(id, border, finish, rarity, cards(id, card_name, god_form, element, attack, defense, players(name, category, image_url)))')
          .eq('user_id', session.user.id)
          .order('acquired_at', { ascending: false })
          .limit(5);
        setPulled(latest || []);
      }
    } catch (e) {
      setMsg('Failed to open pack.');
    }
    setOpening(false);
  };

  const ask = async () => {
    if (!q.trim() || asking) return;
    setAsking(true);
    setAns('Athena consults the scrolls of Mount Olympus...');
    try {
      const r = await fetch('/api/oracle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.access_token,
        },
        body: JSON.stringify({ question: q }),
      });
      const data = await r.json();
      setAns(data.answer || 'Athena has ascended to Mount Olympus to commune with the Fates—return shortly.');
    } catch (e) {
      setAns('Athena has ascended to Mount Olympus to commune with the Fates—return shortly.');
    }
    setAsking(false);
  };

  if (!session) {
    return (
      <main>
        <h1>{APP_NAME}</h1>
        <input placeholder="Username (sign up)" onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input placeholder="Email" onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input type="password" placeholder="Password" onChange={(e) => setF({ ...f, pw: e.target.value })} />
        <p>
          <button className="pri" onClick={() => auth(true)}>Sign up</button>
          <button onClick={() => auth(false)}>Log in</button>
        </p>
        <p>{msg}</p>
      </main>
    );
  }

  const username = session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'Collector';

  const VariantCard = ({ v }) => {
    const c = v?.cards || {};
    const p = c?.players || {};
    const rClass = RARITY_CLASS[v?.rarity] || 'r0';
    return (
      <div className={`card ${rClass}`}>
        <div className="tag">
          {v?.rarity || 'Common'} · {GOD_ICON[c.god_form] || ''} {c.god_form} ({c.element})
        </div>
        {p.image_url && (
          <img
            src={p.image_url}
            alt={p.name || c.card_name}
            style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6, margin: '6px 0' }}
          />
        )}
        <b>{c.card_name || p.name}</b>
        <div className="mut">{p.category} · {v?.border} ({v?.finish})</div>
        <div>
          ATK <b>{c.attack ?? '–'}</b> · DEF <b>{c.defense ?? '–'}</b>
        </div>
      </div>
    );
  };

  return (
    <main>
      <h1>{APP_NAME}</h1>
      <p>
        {username} · <b>{d.wallet?.coins ?? 0}</b> coins{' '}
        <button onClick={() => supabase.auth.signOut()}>Log out</button>
      </p>

      {[
        ['shop', 'Shop'],
        ['col', `Collection (${d.myCards.length})`],
        ['lb', 'Cards & Stats'],
        ['athena', 'Ask Athena'],
      ].map((t) => (
        <button
          key={t[0]}
          className={tab === t[0] ? 'on' : ''}
          onClick={() => {
            setTab(t[0]);
            setMsg('');
          }}
        >
          {t[1]}
        </button>
      ))}

      <p className="mut">{msg}</p>

      {tab === 'shop' && (
        <>
          <div className="grid">
            {d.packs.map((p) => {
              const isEventEmpty = p.name.toLowerCase().includes('event');
              return (
                <div className="card" key={p.id}>
                  <b>{p.name}</b>
                  <div className="mut">{p.description}</div>
                  <p>
                    <b>{p.price_coins}</b> coins · {p.cards_per_pack} cards
                  </p>
                  <button
                    className="pri"
                    disabled={opening || isEventEmpty}
                    onClick={() => buy(p.id)}
                  >
                    {isEventEmpty ? 'Coming Soon' : opening ? 'Opening...' : 'Buy & open'}
                  </button>
                </div>
              );
            })}
          </div>

          {pulled.length > 0 && (
            <>
              <h3>You pulled</h3>
              <div className="grid">
                {pulled.map((item) => (
                  <VariantCard key={item.id} v={item.card_variants} />
                ))}
              </div>
            </>
          )}

          <h3>Featured Trojan Haul Cards</h3>
          <div className="grid">
            {d.cards.slice(0, 12).map((c) => (
              <div className="card r2" key={c.id}>
                <div className="tag">
                  {GOD_ICON[c.god_form] || ''} {c.god_form} · {c.element}
                </div>
                {c.players?.image_url && (
                  <img
                    src={c.players.image_url}
                    alt={c.players.name}
                    style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6, margin: '6px 0' }}
                  />
                )}
                <b>{c.card_name}</b>
                <div className="mut">{c.players?.category}</div>
                <div>
                  ATK <b>{c.attack}</b> · DEF <b>{c.defense}</b>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'col' && (
        <>
          {d.myCards.length === 0 ? (
            <p className="mut">No cards yet — open a pack in the Shop!</p>
          ) : (
            <div className="grid">
              {d.myCards.map((item) => (
                <VariantCard key={item.id} v={item.card_variants} />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'lb' && (
        <>
          <h3>Top Cards by Power</h3>
          <table>
            <tbody>
              <tr>
                <th>#</th>
                <th>Card</th>
                <th>God Form</th>
                <th>Element</th>
                <th>ATK</th>
                <th>DEF</th>
              </tr>
              {[...d.cards]
                .sort((a, b) => b.attack + b.defense - (a.attack + a.defense))
                .slice(0, 25)
                .map((c, i) => (
                  <tr key={c.id}>
                    <td>{i + 1}</td>
                    <td>{c.card_name}</td>
                    <td>{c.god_form}</td>
                    <td>{c.element}</td>
                    <td>{c.attack}</td>
                    <td>{c.defense}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      )}

      {tab === 'athena' && (
        <>
          <h3>Athena, goddess of wisdom</h3>
          <input
            style={{ width: '70%' }}
            placeholder="Which pack or god form should I chase?"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
          />
          <button className="pri" onClick={ask} disabled={asking}>
            Ask
          </button>
          <p style={{ whiteSpace: 'pre-wrap' }}>{ans}</p>
        </>
      )}
    </main>
  );
}
