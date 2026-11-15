import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { admin } from '@/lib/server';

const FALLBACK_MSG =
  'Athena has ascended to Mount Olympus to commune with the Fates—return shortly.';

async function getUser(req) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return null;
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const { data } = await sb.auth.getUser(token);
  return data?.user || null;
}

export async function GET(req) {
  const user = await getUser(req);
  const { searchParams } = new URL(req.url);
  const interactionId = searchParams.get('id');
  const question = searchParams.get('q') || '';

  // Mode 1: Poll an active background Gemini interaction
  if (interactionId) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const interaction = await ai.interactions.get(interactionId);

      if (interaction.status === 'completed') {
        const textOutput =
          interaction.outputs?.find((o) => o.type === 'text')?.text ||
          interaction.outputs?.[interaction.outputs.length - 1]?.text ||
          FALLBACK_MSG;

        if (user && question && textOutput !== FALLBACK_MSG) {
          await admin().from('athena_chats').insert({
            user_id: user.id,
            question,
            answer: textOutput,
          });
        }

        return NextResponse.json({ status: 'completed', answer: textOutput });
      }

      if (interaction.status === 'failed' || interaction.status === 'cancelled') {
        return NextResponse.json({ status: 'failed', answer: FALLBACK_MSG });
      }

      return NextResponse.json({ status: interaction.status || 'in_progress' });
    } catch (e) {
      console.error('Oracle poll error:', e.status || e.message);
      return NextResponse.json({ status: 'failed', answer: FALLBACK_MSG });
    }
  }

  // Mode 2: Load saved chat history for the logged-in user
  if (!user) return NextResponse.json({ chats: [] });

  const { data } = await admin()
    .from('athena_chats')
    .select('id, question, answer, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  return NextResponse.json({ chats: data || [] });
}

export async function POST(req) {
  const { question } = await req.json();

  const [{ data: packs }, { data: sampleCards }] = await Promise.all([
    admin().from('packs').select('id,name,description,price_coins,cards_per_pack').eq('is_active', true),
    admin().from('cards').select('id,card_name,god_form,element,attack,defense,players(name,category)').limit(40),
  ]);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompt = `You are Athena, grey-eyed goddess of wisdom, advising Trojan Haul card collectors in a rich, Homeric mythic voice—speaking of voyages, wine-dark seas, bronze shields, and glory, while remaining clear enough for a mortal collector to follow. Use only this market data:
God forms: Zeus (Lightning, 95 ATK/85 DEF), Poseidon (Water, 90 ATK/90 DEF), Hades (Shadow, 98 ATK/80 DEF), Ares (Fire, 100 ATK/70 DEF).
Rarities: Common (Matte), Rare (Bronze), Epic (Silver Holo), Legendary (Gold & FaZe Red Holo).
Active Packs: ${JSON.stringify(packs)}
Sample Cards: ${JSON.stringify(sampleCards)}
Question: ${question}`;

  const models = ['gemini-3.8-flash', 'gemini-4-hydrogen'];

  for (const model of models) {
    try {
      const interaction = await ai.interactions.create({
        model,
        input: prompt,
        background: true,
      });

      return NextResponse.json({ interactionId: interaction.id });
    } catch (e) {
      console.error(`Oracle start error (${model}):`, e.status || e.message);
    }
  }

  return NextResponse.json({ answer: FALLBACK_MSG });
}
