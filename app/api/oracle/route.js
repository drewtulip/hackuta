import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { admin } from '@/lib/server';

export async function POST(req) {
  const { question } = await req.json();
  const { data: cards } = await admin()
    .from('cards')
    .select('id,name,kind,variant,rarity,base_value,card_stats(avg_score,kd)');

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 8000 },
  });

  const prompt = `You are the Oracle of Delphi, advising FaZe card collectors in a short, Homeric voice (max 3 sentences). Use only this market data: ${JSON.stringify(cards)}\nQuestion: ${question}`;

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
