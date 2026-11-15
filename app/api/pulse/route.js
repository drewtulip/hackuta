import { NextResponse } from 'next/server';
// Grok social pulse (xAI API is OpenAI-compatible). Set XAI_MODEL from the xAI docs.
export async function POST(req) {
  const { name } = await req.json();
  try {
    const r = await fetch('https://api.x.ai/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.XAI_API_KEY}` },
      body: JSON.stringify({ model: process.env.XAI_MODEL, messages: [{ role: 'user', content: `In 2 sentences, what is the social buzz right now about ${name}?` }] }) });
    const j = await r.json();
    return NextResponse.json({ pulse: j.choices?.[0]?.message?.content || 'unavailable' });
  } catch (e) { return NextResponse.json({ pulse: 'unavailable' }); }
}
