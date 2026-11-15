export const RARITY = ['Mortal', 'Hero', 'Demigod', 'Olympian'];
// Fate Score: base value x recent performance x K/D. Stats come from card_stats (filled by the stats pipeline).
export const value = (c, s) => Math.round(c.base_value * (0.5 + (s?.avg_score ?? 50) / 60) * (0.7 + 0.3 * (s?.kd ?? 1)));
// Seasonal cards are only obtainable inside their window.
export const live = (c, now = new Date()) =>
  (!c.available_from || new Date(c.available_from) <= now) && (!c.available_until || new Date(c.available_until) >= now);
