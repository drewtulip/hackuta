'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

const APP_NAME = 'TROJAN HAUL';
const GODS = {
  Zeus: { el: 'Lightning', c: '#2f55b5', i: '⚡' },
  Poseidon: { el: 'Water', c: '#16808f', i: '🌊' },
  Hades: { el: 'Shadow', c: '#3b2a63', i: '☾' },
  Ares: { el: 'Fire', c: '#e0561e', i: '🔥' },
};
const BORDERS = [
  { id: 'common', label: 'Common', note: 'Base border', color: '#7a8286' },
  { id: 'rare', label: 'Rare', note: 'Bronze border', color: '#e08a2e' },
  { id: 'epic', label: 'Epic', note: 'Silver border', color: '#bcc2c9' },
  { id: 'legendary', label: 'Legendary', note: 'Gold border', color: '#fcc231' },
  { id: 'faze', label: 'Legendary', note: 'FaZe Red border', color: '#e63e2f', name: 'FaZe Red' },
];
const BORDER_RANK = { faze: 4, legendary: 3, epic: 2, rare: 1, common: 0 };
const BORDER_LABEL = { faze: 'Legendary · FaZe Red', legendary: 'Legendary · Gold', epic: 'Epic', rare: 'Rare', common: 'Common' };
const BORDER_SHORT = { faze: 'FaZe Red', legendary: 'Legendary', epic: 'Epic', rare: 'Rare', common: 'Common' };
const RARITY_RANK = { Common: 0, Rare: 1, Epic: 2, Legendary: 3 };
const BACKGROUND_AUDIO_PATH = '/audio/pack-opening-background.opus';
const GOD_AUDIO_PATHS = {
  Zeus: '/audio/zeus.opus',
  Poseidon: '/audio/poseidon.opus',
  Hades: '/audio/hades.opus',
  Ares: '/audio/ares.opus',
};
// Pack-opening sequence duration in milliseconds
const OPEN_DURATION_MS = 10000;
// Share of all cards per border, used until card data has loaded.
const DEFAULT_SHARE = { faze: 3, legendary: 9, epic: 16, rare: 27, common: 45 };
const FILTERS = ['All', 'Common', 'Rare', 'Epic', 'Legendary', 'FaZe Red'];

const DEMO_PACKS = [
  { id: 'd1', name: 'Starter Pack', kicker: 'Best to start', price: '$3.99', cards: 5, perks: ['At least 1 Rare or higher', 'FaZe Red odds: 0.05% per card'] },
  { id: 'd2', name: 'Olympus Pack', kicker: 'Better odds', price: '$12.99', cards: 5, perks: ['At least 1 Epic or higher', 'FaZe Red odds: 0.5% per card'] },
  { id: 'd3', name: 'Legendary Pack', kicker: 'Best odds', price: '$24.99', cards: 5, perks: ['At least 1 Legendary or FaZe Red', 'FaZe Red odds: 2% per card'] },
  { id: 'd4', name: 'FaZe Event Pack', kicker: 'Limited event', price: '$29.99', cards: 5, event: true, perks: ['1 guaranteed event-exclusive card', 'Plus 4 standard draws', 'Only while the event runs'] },
  { id: 'd5', name: 'Collab Pack', kicker: 'Limited collab', price: '$29.99', cards: 5, perks: ['1 guaranteed collab-exclusive card', 'Partner releases, like CORSAIR', 'Only while the collab runs'] },
];
const PLANS = [
  { name: 'Free', price: '$0', rows: [['Monthly packs', 'None'], ['Marketplace fee', '15%'], ['Pro Shop', 'No perks'], ['Drops', 'Public release'], ['Trade hold', '72 hours']], cta: 'Play free' },
  { name: 'FaZe Fan Pass', price: '$6.99', per: '/mo', cls: 'hl', rows: [['Monthly packs', '2 Starter Packs'], ['Marketplace fee', '12%'], ['Pro Shop', '5% off core merch, free shipping over $50'], ['Drops', 'Public release'], ['Trade hold', '72 hours']], cta: 'Start Fan Pass', btn: 'red' },
  { name: 'FaZe Vault VIP', price: '$21.99', per: '/mo', cls: 'dk', rows: [['Monthly packs', '2 Olympus Packs'], ['Marketplace fee', '8%'], ['Pro Shop', '10% off core merch, VIP-only exclusives'], ['Drops', '24-hour early access to event and collab boxes'], ['Trade hold', '24 hours']], cta: 'Join Vault VIP', btn: 'gold' },
];
const TRADES = [
  [['faze', 'Legendary · Ares'], ['epic', 'Epic · Zeus']],
  [['epic', 'Epic · Poseidon'], ['rare', 'Rare · Hades']],
  [['faze', 'FaZe Red · Zeus'], ['legendary', 'Legendary · Poseidon']],
];

function renderAthenaInline(text, keyPrefix) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${keyPrefix}-strong-${index}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={`${keyPrefix}-em-${index}`}>{part.slice(1, -1)}</em>;
    }
    return <span key={`${keyPrefix}-text-${index}`}>{part}</span>;
  });
}

function AthenaMarkdown({ text }) {
  const lines = String(text || '').split(/\r?\n/);
  const content = [];
  let listItems = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    content.push(<ul key={`list-${content.length}`}>{listItems}</ul>);
    listItems = [];
  };

  lines.forEach((line, index) => {
    const listMatch = line.match(/^\s*(?:[*-]|\d+\.)\s+(.+)/);
    if (listMatch) {
      listItems.push(
        <li key={`item-${index}`}>{renderAthenaInline(listMatch[1], `item-${index}`)}</li>
      );
      return;
    }

    flushList();
    if (line.trim()) {
      content.push(
        <p key={`paragraph-${index}`}>{renderAthenaInline(line, `paragraph-${index}`)}</p>
      );
    }
  });

  flushList();
  return <div className="athena-md">{content}</div>;
}

const borderOf = (v) => {
  const b = (v?.border || '').toLowerCase();
  const r = (v?.rarity || '').toLowerCase();
  if (/faze|red/.test(b)) return 'faze';
  if (r === 'legendary') return 'legendary';
  return ['epic', 'rare'].includes(r) ? r : 'common';
};

const Silhouette = () => (
  <svg viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
    <circle cx="50" cy="32" r="18" />
    <path d="M12 100c0-26 17-42 38-42s38 16 38 42z" />
  </svg>
);

function GameCard({ border = 'common', god, name, sub, img, dim, level, small, empty, blank, flat, onClick }) {
  const g = GODS[god];
  const click = onClick
    ? { onClick, role: 'button', tabIndex: 0, 'aria-label': `Inspect ${name}`, onKeyDown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick()) }
    : {};
  return (
    <div className={`gc${flat ? '' : ' tilt'}${onClick ? ' click' : ''}${dim ? ' dim' : ''}${small ? ' sm' : ''}${blank ? ' blank' : ''}`} {...click}>
      <div className="in">
        <div className="top">
          {g ? <span className="god-chip" style={{ background: g.c }}>{god}</span> : <span />}
          <span style={{ color: '#9a9a9a' }}>LV {level ?? '–'}</span>
        </div>
        <div className="photo">{img ? <img src={img} alt={name} /> : <Silhouette />}</div>
        <div className="nm">{empty ? 'Not collected' : name}</div>
        <div className="st">{empty ? 'Open packs to find it' : sub}</div>
      </div>
      <img className="frame" src={`/borders/${border}.png`} alt="" />
    </div>
  );
}


const HOLO = new Set(['epic', 'legendary', 'faze']);

function InspectModal({ info, onClose }) {
  const cardRef = useRef(null);
  const stageRef = useRef(null);
  const st = useRef({ ry: -18, rx: 6, vy: 0, target: null, dragging: false, moved: 0, lastX: 0, lastY: 0, lastT: 0 });
  const g = GODS[info.god];

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf;
    const tick = () => {
      const s = st.current;
      if (!s.dragging) {
        if (s.target !== null) {
          const d = s.target - s.ry;
          s.ry += d * (reduce ? 1 : 0.14);
          if (Math.abs(d) < 0.1) { s.ry = s.target; s.target = null; }
        } else if (Math.abs(s.vy) > 0.02) { s.ry += s.vy; s.vy *= 0.95; }
        else {
          s.vy = 0;
          const snap = Math.round(s.ry / 180) * 180;
          if (Math.abs(snap - s.ry) < 40) s.ry += (snap - s.ry) * 0.06;
        }
        s.rx += (6 - s.rx) * 0.06;
      }
      const el = cardRef.current;
      if (el) {
        el.style.transform = `rotateX(${s.rx}deg) rotateY(${s.ry}deg)`;
        const n = ((s.ry % 360) + 360) % 360;
        el.style.setProperty('--gx', `${50 - Math.sin((n * Math.PI) / 180) * 60}%`);
        el.style.setProperty('--gy', `${30 - s.rx * 3}%`);
        el.style.setProperty('--ga', `${s.ry * 1.5}deg`);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    const key = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    stageRef.current?.focus();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', key); };
  }, [onClose]);

  const flip = () => { const s = st.current; s.vy = 0; s.target = (Math.round(s.ry / 180) + 1) * 180; };
  const down = (e) => {
    const s = st.current;
    s.dragging = true; s.moved = 0; s.vy = 0; s.target = null;
    s.lastX = e.clientX; s.lastY = e.clientY; s.lastT = performance.now();
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    const s = st.current;
    if (!s.dragging) {
      const r = e.currentTarget.getBoundingClientRect();
      s.rx = 6 - ((e.clientY - r.top) / r.height - 0.5) * 16;
      return;
    }
    const dx = e.clientX - s.lastX, dy = e.clientY - s.lastY, now = performance.now();
    s.moved += Math.abs(dx) + Math.abs(dy);
    s.ry += dx * 0.45;
    s.rx = Math.max(-25, Math.min(25, s.rx - dy * 0.25));
    s.vy = (dx * 0.45) / Math.max(1, (now - s.lastT) / 16);
    s.lastX = e.clientX; s.lastY = e.clientY; s.lastT = now;
  };
  const up = () => { const s = st.current; s.dragging = false; if (s.moved < 6) flip(); };
  const keys = (e) => {
    const s = st.current;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
    if (e.key === 'ArrowLeft') { s.target = null; s.vy = -4; }
    if (e.key === 'ArrowRight') { s.target = null; s.vy = 4; }
  };

  const power = (info.atk ?? 0) + (info.def ?? 0);
  const rows = [
    ['Attack', info.atk ?? '–'],
    ['Defense', info.def ?? '–'],
    ['Rarity', info.rarity || BORDER_SHORT[info.border]],
    ['Border', BORDER_LABEL[info.border]],
    ['God form', info.god ? `${info.god}${g ? `, ${g.el}` : ''}` : '–'],
    ['Category', info.category || '–'],
  ];

  return (
    <div className="modal" onClick={onClose}>
      <div className="inspect" role="dialog" aria-modal="true" aria-label={`${info.name} card`} onClick={(e) => e.stopPropagation()}>
        <button className="x" onClick={onClose} aria-label="Close">×</button>
        <div
          className="stage"
          ref={stageRef}
          tabIndex={0}
          aria-label="Card. Drag to spin, click or press Enter to flip, arrow keys to turn."
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => { st.current.dragging = false; }}
          onKeyDown={keys}
        >
          <div className="shadow" />
          <div className={`ccard${HOLO.has(info.border) ? ' holo-on' : ''}`} ref={cardRef}>
            <div className="face">
              <GameCard border={info.border} god={info.god} name={info.name} sub={`${BORDER_LABEL[info.border]}`} img={info.img} level={info.level} flat />
              <div className="holo" /><div className="gloss" />
            </div>
            <div className="face back">
              <div className="gc">
                <div className="in back-in">
                  <div className="nm">{info.name}</div>
                  <div className="fate"><b>{power}</b><span>Power</span></div>
                  <dl>
                    {rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
                  </dl>
                </div>
                <img className="frame" src={`/borders/${info.border}.png`} alt="" />
              </div>
              <div className="gloss" />
            </div>
          </div>
        </div>
        <div className="side">
          <h2>{info.name}</h2>
          <p className="mut">Drag to spin the card, click to flip it, and tilt it to catch the light. The back shows this card's stats.</p>
          <div className="meta">
            <span><i className="sq" style={{ background: BORDERS.find((b) => b.id === info.border)?.color }} />{BORDER_LABEL[info.border]}</span>
            {g && <span><i className="dot" style={{ background: g.c }} />{info.god} · {g.el}</span>}
          </div>
          <div className="row2" style={{ margin: '18px 0 0' }}>
            <button className="btn red" onClick={flip}>Flip card</button>
            <button className="btn" onClick={onClose}>Close</button>
          </div>
          <div className="hint">Keyboard: arrow keys turn the card, Enter flips it, Esc closes.</div>
        </div>
      </div>
    </div>
  );
}

const Pills = ({ opts, val, set, godsToo }) => (
  <div className="pills">
    {opts.map((o) => (
      <button key={o} className={`pill${val === o ? ' on' : ''}`} onClick={() => set(o)}>{o}</button>
    ))}
    {godsToo && <span className="sep" />}
    {godsToo && Object.keys(GODS).map((o) => (
      <button key={o} className={`pill${val === o ? ' on' : ''}`} onClick={() => set(o)}>{o}</button>
    ))}
  </div>
);

const matches = (filter, border, god) =>
  filter === 'All' ||
  (GODS[filter] ? god === filter : (filter === 'FaZe Red' ? border === 'faze' : BORDER_SHORT[border] === filter && border !== 'faze'));

export default function Home() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState('home');
  const [msg, setMsg] = useState('');
  const [pulled, setPulled] = useState([]);
  const [opening, setOpening] = useState(false);
  const [d, setD] = useState({ packs: [], cards: [], variants: [], wallet: null, myCards: [] });
  const [f, setF] = useState({ email: '', pw: '', name: '' });
  const [q, setQ] = useState('');
  const [chats, setChats] = useState([]);
  const [pending, setPending] = useState('');
  const chatEndRef = useRef(null);
  const [asking, setAsking] = useState(false);
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('rare');
  const [lbShown, setLbShown] = useState(7);
  const [inspect, setInspect] = useState(null);
  const packsRef = useRef(null);

  // Audio players kept across re-renders without triggering state updates
  const openAudioRef = useRef(null);
  const godAudioRefs = useRef({});
  const activeGodAudioRef = useRef(null);

  useEffect(() => {
    const audio = new Audio(BACKGROUND_AUDIO_PATH);
    audio.preload = 'metadata';
    audio.volume = 0.6;
    audio.loop = true;
    openAudioRef.current = audio;

    const loadedGodAudios = {};
    for (const [god, path] of Object.entries(GOD_AUDIO_PATHS)) {
      const a = new Audio(path);
      a.preload = 'metadata';
      a.volume = 0.6;
      loadedGodAudios[god] = a;
    }
    godAudioRefs.current = loadedGodAudios;

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);

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

  // Saved Athena chat history for the signed-in user
  useEffect(() => {
    if (!session) { setChats([]); return; }
    fetch('/api/oracle', { headers: { Authorization: 'Bearer ' + session.access_token } })
      .then((r) => r.json())
      .then((j) => setChats(j.chats || []))
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [chats, pending]);

  const go = (v) => {
    setMsg('');
    if (v === 'packs') {
      setView('home');
      setTimeout(() => packsRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
      return;
    }
    setView(v);
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  };

  const auth = async (up) => {
    const { error } = up
      ? await supabase.auth.signUp({ email: f.email, password: f.pw, options: { data: { username: f.name } } })
      : await supabase.auth.signInWithPassword({ email: f.email, password: f.pw });
    setMsg(error ? error.message : '');
    if (!error) setView('home');
  };

  const stopActiveGodAudio = () => {
    if (activeGodAudioRef.current) {
      activeGodAudioRef.current.pause();
      activeGodAudioRef.current.currentTime = 0;
      activeGodAudioRef.current = null;
    }
  };

  // Play the god-form sound of the highest-rarity Epic or Legendary pull
  const triggerGodPullAudio = (pulledItems) => {
    let topPull = null;
    let topRank = RARITY_RANK.Epic - 1;
    for (const item of pulledItems) {
      const rarity = item?.card_variants?.rarity;
      const godForm = item?.card_variants?.cards?.god_form;
      const rank = RARITY_RANK[rarity] ?? -1;
      if (rank > topRank && godForm && godAudioRefs.current[godForm]) {
        topRank = rank;
        topPull = godForm;
      }
    }
    if (topPull) {
      stopActiveGodAudio();
      const godAudio = godAudioRefs.current[topPull];
      godAudio.currentTime = 0;
      activeGodAudioRef.current = godAudio;
      godAudio.play().catch((err) => console.error(`${topPull} reveal audio playback failed:`, err));
    }
  };

  const buy = async (packId) => {
    if (opening) return;
    if (!session) return go('auth');

    stopActiveGodAudio();

    // Start the 10-second pack-opening loop
    if (openAudioRef.current) {
      const audio = openAudioRef.current;
      audio.currentTime = 0;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.playbackRate = Math.min(Math.max(audio.duration / 10, 0.5), 2.0);
      }
      audio.play().catch((err) => console.error('Pack opening audio playback failed:', err));
    }

    setOpening(true);
    setMsg('Opening pack...');
    const tenSecondTimer = new Promise((resolve) => setTimeout(resolve, OPEN_DURATION_MS));

    try {
      // Run the API call, data reload, and 10s timer concurrently
      const [result] = await Promise.all([
        (async () => {
          const r = await fetch('/api/packs/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
            body: JSON.stringify({ packId }),
          }).then((res) => res.json());
          if (r.error) return { error: r.error };

          await load(session.user.id);
          const { data: latest } = await supabase
            .from('user_cards')
            .select('id, card_variants(id, border, finish, rarity, cards(id, card_name, god_form, element, attack, defense, players(name, category, image_url)))')
            .eq('user_id', session.user.id)
            .order('acquired_at', { ascending: false })
            .limit(5);
          return { latest: latest || [] };
        })(),
        tenSecondTimer,
      ]);

      if (openAudioRef.current) {
        openAudioRef.current.pause();
        openAudioRef.current.currentTime = 0;
      }

      if (result.error) {
        setMsg(result.error);
      } else {
        setMsg('Pack opened! Check your new cards below.');
        setPulled(result.latest);
        triggerGodPullAudio(result.latest);
      }
    } catch (e) {
      setMsg('Failed to open pack.');
    } finally {
      if (openAudioRef.current) {
        openAudioRef.current.pause();
        openAudioRef.current.currentTime = 0;
      }
      setOpening(false);
    }
  };

  const ATHENA_FALLBACK = 'Athena has ascended to Mount Olympus to commune with the Fates—return shortly.';

  const ask = async () => {
    const question = q.trim();
    if (!question || asking) return;
    setAsking(true);
    setQ('');
    setPending(question);
    const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token };
    let answer = ATHENA_FALLBACK;
    try {
      const r = await fetch('/api/oracle', { method: 'POST', headers, body: JSON.stringify({ question }) });
      const data = await r.json();
      if (data.answer) {
        answer = data.answer;
      }
    } catch (e) {
      answer = ATHENA_FALLBACK;
    }
    setChats((c) => [...c, { id: 'local-' + Date.now(), question, answer }]);
    setPending('');
    setAsking(false);
  };

  const variantCard = (v, key, extra = {}) => {
    const c = v?.cards || {};
    const p = c.players || {};
    const b = borderOf(v);
    const name = p.name || c.card_name;
    const info = {
      border: b, god: c.god_form, name, img: p.image_url, level: c.level,
      rarity: v?.rarity, atk: c.attack, def: c.defense, category: p.category,
    };
    return (
      <GameCard
        key={key}
        border={b}
        god={c.god_form}
        name={name}
        sub={`${BORDER_SHORT[b]} · ${c.god_form || ''}`}
        img={p.image_url}
        level={c.level}
        onClick={() => setInspect(info)}
        {...extra}
      />
    );
  };

  /* ---------- data derived for the views ---------- */
  const livePacks = d.packs.length
    ? d.packs.map((p) => ({
        id: p.id,
        name: p.name,
        kicker: p.name.toLowerCase().includes('event') ? 'Limited event' : 'Pack',
        price: `${p.price_coins} coins`,
        cards: p.cards_per_pack,
        event: p.name.toLowerCase().includes('event'),
        perks: p.description ? [p.description] : [],
        live: true,
      }))
    : DEMO_PACKS;

  const owned = d.myCards
    .map((u) => ({ id: u.id, v: u.card_variants }))
    .filter((x) => x.v)
    .map((x) => ({ ...x, border: borderOf(x.v), god: x.v.cards?.god_form }));
  const shown = owned
    .filter((x) => matches(filter, x.border, x.god))
    .sort((a, b) => (sort === 'rare' ? BORDER_RANK[b.border] - BORDER_RANK[a.border] : sort === 'new' ? 0 : (a.god || '').localeCompare(b.god || '')));
  const ownedIds = new Set(owned.map((x) => x.v.cards?.id));
  const locked = filter === 'All' ? d.cards.filter((c) => !ownedIds.has(c.id)).slice(0, 4) : [];
  const tally = (id) => owned.filter((x) => x.border === id).length;
  const TOTAL = 5780;

  const ranked = [...d.variants]
    .map((v) => {
      const c = d.cards.find((c) => c.id === v.card_id) || {};
      return { v, c, border: borderOf(v), power: (c.attack || 0) + (c.defense || 0) };
    })
    .sort((a, b) => BORDER_RANK[b.border] - BORDER_RANK[a.border] || b.power - a.power);
  const share = (() => {
    const counts = {};
    d.variants.forEach((v) => { const b = borderOf(v); counts[b] = (counts[b] || 0) + 1; });
    const total = d.variants.length;
    return Object.fromEntries(Object.keys(DEFAULT_SHARE).map((k) => [k, total ? Math.round(((counts[k] || 0) / total) * 100) : DEFAULT_SHARE[k]]));
  })();
  const lbRows = ranked.filter((r) => filter === 'All' || matches(filter, r.border, r.c.god_form));

  const username = session?.user?.user_metadata?.username || session?.user?.email?.split('@')[0] || 'Collector';

  const nav = (
    <nav className="nav">
      <a className="brand" href="#" onClick={(e) => { e.preventDefault(); go('home'); }} aria-label={APP_NAME}>
        <span className="logo" />
        <span className="bname">{APP_NAME}</span>
      </a>
      <ul>
        {[['home', 'Home'], ['packs', 'Packs'], ['collection', 'Collection'], ['trade', 'Trade'], ['leaderboard', 'Leaderboard']].map(([id, l]) => (
          <li key={id}><button className={view === id ? 'on' : ''} onClick={() => go(session || ['home', 'packs'].includes(id) ? id : 'auth')}>{l}</button></li>
        ))}
      </ul>
      <button className="cta" onClick={() => go('packs')}>Open a pack</button>
    </nav>
  );
  const footer = (
    <footer className="foot">
      <div className="meander" />
      <div className="in"><b>{APP_NAME}</b><span>Built at HackUTA 2026</span></div>
    </footer>
  );

  const FilterBar = ({ label }) => <Pills opts={FILTERS} val={filter} set={setFilter} godsToo />;

  let body;

  if (view === 'auth') {
    body = (
      <div className="auth">
        <h2>{APP_NAME}</h2>
        <div className="mut">Sign in to open packs and build your collection.</div>
        <input placeholder="Username (sign up)" onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input placeholder="Email" onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input type="password" placeholder="Password" onChange={(e) => setF({ ...f, pw: e.target.value })} />
        <div className="row">
          <button className="btn red" onClick={() => auth(true)}>Sign up</button>
          <button className="btn" onClick={() => auth(false)}>Log in</button>
        </div>
        <p className="msg">{msg}</p>
      </div>
    );
  } else if (view === 'collection') {
    body = (
      <div className="wrap page">
        <div className="ph"><h1>My Collection</h1><p>Every card you own, in every god form and border. Cards level up as your players play, so check back after match days.</p></div>
        <div className="cbar">
          <div>
            <div className="tl"><span className="big">{owned.length}</span> / {TOTAL.toLocaleString()} CARDS COLLECTED</div>
            <div className="bar"><i style={{ width: `${Math.max(2, (owned.length / TOTAL) * 100)}%` }} /></div>
          </div>
          <div className="tally">
            {BORDERS.map((b) => (
              <div key={b.id}><i style={{ borderColor: b.color }} /><b>{tally(b.id)}</b>{b.name || b.label}</div>
            ))}
          </div>
        </div>
        {owned.length === 0 && <p className="mut">No cards yet — open a pack to start your collection.</p>}
        <div className="cgrid">
          {shown.map((x) => variantCard(x.v, x.id, { dim: false }))}
          {locked.map((c) => (
            <GameCard key={'l' + c.id} border="common" god={c.god_form} dim empty />
          ))}
        </div>
        <div className="fbar">
          <FilterBar />
          <select className="sortsel" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="rare">Sort: Rarest first</option>
            <option value="god">Sort: God form</option>
            <option value="new">Sort: Newest</option>
          </select>
        </div>
      </div>
    );
  } else if (view === 'trade') {
    body = (
      <div className="wrap page">
        <div className="ph"><h1>Trading Hub</h1><p>Swap cards with other fans to finish your collection. Every trade shows both cards, their border and god form, before you accept.</p></div>
        <FilterBar />
        <div className="two" style={{ marginTop: 20 }}>
          <div className="panel">
            <h3><span><span className="red">● </span>Open trades</span><small>{TRADES.length} open trades</small></h3>
            {TRADES.map(([a, b], i) => (
              <div className="trade" key={i}>
                <div className="who">@collector</div>
                {[a, b].map(([bd, l], j) => (
                  <span key={j} style={{ display: 'contents' }}>
                    <div className="side"><GameCard border={bd} small /><div><b>[Gamertag]</b>{l}</div></div>
                    {j === 0 && <span className="arrow">⇄</span>}
                  </span>
                ))}
                <button className="btn">View</button>
              </div>
            ))}
            <div className="pad row2" style={{ margin: 0 }}>
              <button className="btn red">Post a trade</button>
              <button className="btn">Browse all</button>
            </div>
            <p className="soon">Live trading is coming soon — this is a preview of the hub.</p>
          </div>
          <div className="panel">
            <h3>Your trades</h3>
            <div className="wallet"><div><small>Wallet</small><b>{d.wallet?.coins ?? 0} coins</b></div><button className="btn red">Add funds</button></div>
            <div className="three"><div><b>2</b>Listed</div><div><b>3</b>Offers in</div><div><b>7</b>Completed</div></div>
            <div className="mut" style={{ margin: '14px 16px 0', fontSize: 11 }}>Latest offer on your card</div>
            <div className="offer"><GameCard border="legendary" small /><div><div className="mut">@collector wants</div><b>[Gamertag] · Legendary · Ares</b></div></div>
            <div className="row2"><button className="btn red">Accept</button><button className="btn">Counter</button></div>
            <div className="row2"><button className="btn">Manage my listings</button></div>
            <div className="fees">
              <div><span className="mut">Marketplace fee</span><b>15%</b></div>
              <div><span className="mut">With Fan Pass</span><b>12%</b></div>
              <div><span className="mut">With Vault VIP</span><b>8%</b></div>
              <p className="mut" style={{ fontSize: 10 }}>New cards can be traded after 72 hours, or 24 hours with Vault VIP. This stops bot sniping and chargeback fraud.</p>
            </div>
          </div>
        </div>
      </div>
    );
  } else if (view === 'leaderboard') {
    const top = lbRows.slice(0, 3);
    const order = [top[1], top[0], top[2]];
    body = (
      <div className="wrap page">
        <div className="ph"><h1>Leaderboard</h1><p>The rarest cards in the game, ranked by border and power. FaZe Red borders sit at the top.</p></div>
        <FilterBar />
        <div className="two" style={{ marginTop: 20, gridTemplateColumns: '1fr 280px' }}>
          <div>
            {top.length > 0 && (
              <div className="podium">
                {order.map((r, i) => {
                  if (!r) return <div key={i} />;
                  const rank = [2, 1, 3][i];
                  const p = r.c.players || {};
                  return (
                    <div key={r.v.id} className={`pod${rank === 1 ? ' first' : ''}`}>
                      <span className="rk" style={{ background: ['#fcc231', '#bcc2c9', '#e08a2e'][rank - 1] }}>{rank}</span>
                      <GameCard border={r.border} god={r.c.god_form} name={p.name || r.c.card_name} sub="" img={p.image_url} />
                      <b>{p.name || r.c.card_name}</b>
                      <small>{BORDER_LABEL[r.border]} · {r.c.god_form}</small>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="panel">
              <table className="lb">
                <thead><tr><th>Rank</th><th>Card</th><th>Border</th><th>God form</th></tr></thead>
                <tbody>
                  {lbRows.slice(3, lbShown + 3).map((r, i) => {
                    const p = r.c.players || {};
                    const g = GODS[r.c.god_form];
                    return (
                      <tr key={r.v.id}>
                        <td>{i + 4}</td>
                        <td><div className="nmc"><GameCard border={r.border} small />{p.name || r.c.card_name}</div></td>
                        <td><i className="sq" style={{ background: BORDERS.find((b) => b.id === r.border).color }} />{BORDER_LABEL[r.border]}</td>
                        <td>{g && <i className="dot" style={{ background: g.c }} />}{r.c.god_form}</td>
                      </tr>
                    );
                  })}
                  {lbRows.length === 0 && <tr><td colSpan="4" className="mut">No cards to rank yet.</td></tr>}
                </tbody>
              </table>
            </div>
            {lbRows.length > lbShown + 3 && (
              <div className="center"><button className="btn" onClick={() => setLbShown(lbShown + 7)}>Load more</button></div>
            )}
          </div>
          <div className="panel">
            <h3>Rarity by border</h3>
            {[...BORDERS].reverse().map((b, i) => (
              <div className="rbb" key={b.id}>
                <GameCard border={b.id} small />
                <div><b>{b.id === 'faze' ? 'Legendary · FaZe Red' : b.id === 'legendary' ? 'Legendary · Gold' : b.label}</b><small>{['Rarest', '', '', '', 'Most common'][i]}</small></div>
                <span>{share[b.id]}%<br /><small className="mut" style={{ fontWeight: 400, fontFamily: 'Barlow', fontSize: 9 }}>Of all cards</small></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  } else {
    body = (
      <>
        <section className="wrap hero">
          <div className="eyebrow">Season 1</div>
          <h1>{APP_NAME}</h1>
          <h2 className="tag">Open a pack. Back a player.</h2>
          <p>Every legend starts with a journey. Collect player cards that level up with real stats, and follow your players from first match to the finals.</p>
          <div className="row">
            {session ? (
              <button className="btn red" onClick={() => go('collection')}>My collection</button>
            ) : (
              <button className="btn red" onClick={() => go('auth')}>Sign up free</button>
            )}
            <button className="btn" onClick={() => go('packs')}>Shop packs</button>
          </div>
        </section>
        <section className="wrap about">
          <h3>Who are we?</h3>
          <div className="mut" style={{ fontSize: 13, margin: '6px 0 0' }}>We don't just collect cards. We back players.</div>
          <div className="big">{APP_NAME} is a card platform built for FaZe fans. Every card is a real FaZe player in one of four god forms, and every card levels up as their stats do. Open packs, trade with other fans, and follow your players on their odyssey from first match to the finals.</div>
        </section>
        <div className="divider" />

        <section className="wrap sec" ref={packsRef} id="packs">
          <div className="sh"><h2>Packs</h2><p>Choose your voyage. Every pack holds 5 cards, paid from your FaZe Wallet. Higher packs guarantee rarer borders, and event and collab packs add limited cards you can only get while they run.</p></div>
          <div className="packs">
            {livePacks.map((p) => {
              const unavailable = p.live && p.event;
              return (
                <div className={`pack${p.event ? ' ev' : ''}`} key={p.id}>
                  <div className="art" />
                  <div className="bd">
                    <div className="k">{p.kicker}</div>
                    <h4>{p.name}</h4>
                    <div className="pr">{p.price}</div>
                    <div className="n">{p.cards} cards</div>
                    <ul>{p.perks.map((x) => <li key={x}>{x}</li>)}</ul>
                    <button className="btn red full" disabled={opening || unavailable} onClick={() => (p.live ? buy(p.id) : go(session ? 'packs' : 'auth'))}>
                      {unavailable ? 'Coming soon' : opening ? 'Opening...' : 'Buy pack'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {msg && <p className="msg">{msg}</p>}
          <p className="fine">Full odds are shown before you buy. Wallet funds stay inside FaZe and can be spent on packs, marketplace cards, or Pro Shop merch.</p>
          {pulled.length > 0 && (
            <>
              <div className="sub">You pulled</div>
              <div className="cgrid">{pulled.map((it) => variantCard(it.card_variants, it.id))}</div>
            </>
          )}
        </section>

        <section className="wrap sec">
          <div className="sh"><h2>Memberships</h2><p>Get monthly packs, lower marketplace fees, and Pro Shop perks. Cancel anytime.</p></div>
          <div className="plans">
            {PLANS.map((p) => (
              <div className={`plan ${p.cls || ''}`} key={p.name}>
                <h4>{p.name}</h4>
                <div className="p">{p.price}{p.per && <small>{p.per}</small>}</div>
                <dl>{p.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
                <button className={`btn full ${p.btn || ''}`} onClick={() => go(p.name === 'Free' && !session ? 'auth' : 'packs')}>{p.cta}</button>
              </div>
            ))}
          </div>
        </section>

        <section className="wrap sec">
          <div className="sh"><h2>Cards</h2><p>Every FaZe player comes in 4 god forms, and every form comes in 5 borders. Collect them all to complete the pantheon.</p></div>
          <div className="eq">
            <div>289<small>FaZe players</small></div><span className="op">×</span>
            <div>4<small>God forms</small></div><span className="op">×</span>
            <div>5<small>Borders</small></div><span className="op">=</span>
            <div className="tot">5,780<small>Unique cards</small></div>
          </div>
          <div className="sub">Borders</div>
          <div className="bgrid">
            {BORDERS.map((b) => (
              <div key={b.id}>
                <div style={{ width: 90, margin: '0 auto' }}><GameCard border={b.id} blank /></div>
                <b>{b.label}</b><small>{b.note}</small>
              </div>
            ))}
          </div>
          <div className="sub">God forms</div>
          <div className="gods">
            {Object.entries(GODS).map(([n, g]) => (
              <div className="god" key={n}><i style={{ background: g.c }}>{g.i}</i><div><b>{n}</b><small>{g.el}</small></div></div>
            ))}
          </div>
        </section>

        {session && (
          <section className="wrap sec">
            <div className="sh"><h2>Ask Athena</h2><p>Goddess of wisdom. Ask which pack or god form to chase.</p></div>
            <div className="ask">
              <div className="chat" aria-live="polite">
                {chats.length === 0 && !pending && (
                  <p className="mut chat-empty">No questions yet. Ask Athena which pack or god form to chase.</p>
                )}
                {chats.map((c) => (
                  <div key={c.id}>
                    <div className="bub q"><b>You</b>{c.question}</div>
                    <div className="bub a"><b>Athena</b><AthenaMarkdown text={c.answer} /></div>
                  </div>
                ))}
                {pending && (
                  <div>
                    <div className="bub q"><b>You</b>{pending}</div>
                    <div className="bub a wait"><b>Athena</b>Athena consults the scrolls of Mount Olympus...</div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="row">
                <input placeholder="Which pack or god form should I chase?" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} disabled={asking} />
                <button className="btn red" onClick={ask} disabled={asking}>{asking ? 'Consulting...' : 'Ask'}</button>
              </div>
            </div>
          </section>
        )}
      </>
    );
  }

  return (
    <>
      {nav}
      {session && (
        <div style={{ background: '#111', color: '#fff', fontSize: 12, padding: '6px 20px', display: 'flex', justifyContent: 'flex-end', gap: 14 }}>
          <span>{username} · <b>{d.wallet?.coins ?? 0}</b> coins</span>
          <a href="#" style={{ color: '#aaa' }} onClick={(e) => { e.preventDefault(); supabase.auth.signOut(); }}>Log out</a>
        </div>
      )}
      <main>{body}</main>
      {inspect && <InspectModal info={inspect} onClose={() => setInspect(null)} />}
      {footer}
    </>
  );
}
