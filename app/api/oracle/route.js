import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { admin } from '@/lib/server';

export async function POST(req) {
  const { question } = await req.json();

  const [{ data: packs }, { data: sampleCards }] = await Promise.all([
    admin().from('packs').select('id,name,description,price_coins,cards_per_pack').eq('is_active', true),
    admin().from('cards').select('id,card_name,god_form,element,attack,defense,players(name,category)').limit(40),
  ]);

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 8000 },
  });

  const prompt = `You are the Oracle of Delphi advising FaZe: Odyssey card collectors in a short, Homeric voice (max 3 sentences).
God forms: Zeus (Lightning, 95 ATK/85 DEF), Poseidon (Water, 90 ATK/90 DEF), Hades (Shadow, 98 ATK/80 DEF), Ares (Fire, 100 ATK/70 DEF).
Rarities: Common (Matte), Rare (Bronze), Epic (Silver Holo), Legendary (Gold & FaZe Red Holo).
Active Packs: ${JSON.stringify(packs)}
Sample Cards: ${JSON.stringify(sampleCards)}
Question: ${question}`;

  const models = ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash'];

  for (const model of models) {
    try {
      const r = await ai.models.generateContent({
        model,
        contents: prompt,
      });
      return NextResponse.json({ answer: r.text });
    } catch (e) {
      console.error(`Oracle error (${model}):`, e.status || e.message);
    }
  }

  return NextResponse.json({ answer: 'The Oracle is silent right now.' });
}
