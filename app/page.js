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
        {session && (
          <section className="wrap sec">
            <div className="sh"><h2>Ask Athena</h2><p>Goddess of wisdom. Ask which pack or god form to chase.</p></div>
            <div className="ask">
              {chats.length > 0 && (
                <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {chats.map((c) => (
                    <div key={c.id} style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)' }}>
                      <div style={{ fontSize: 13, color: 'var(--mut)' }}><b>You:</b> {c.question}</div>
                      <p style={{ whiteSpace: 'pre-wrap', marginTop: 6, marginBottom: 0 }}><b>Athena:</b> {c.answer}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="row">
                <input placeholder="Which pack or god form should I chase?" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} />
                <button className="btn red" onClick={ask} disabled={asking}>{asking ? 'Consulting...' : 'Ask'}</button>
              </div>
              {ans && <p className="mut" style={{ whiteSpace: 'pre-wrap', marginTop: 12, marginBottom: 0 }}>{ans}</p>}
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
