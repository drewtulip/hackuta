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
  try {
    const user = await getUser(req);
    const body = await req.json();
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    if (!question) return NextResponse.json({ answer: FALLBACK_MSG }, { status: 400 });

    const [{ data: packs }, { data: sampleCards }] = await Promise.all([
      admin().from('packs').select('id,name,description,price_coins,cards_per_pack').eq('is_active', true),
      admin().from('cards').select('id,card_name,god_form,element,attack,defense,players(name,category)').limit(40),
    ]);

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        timeout: 15000,
        retryOptions: { attempts: 1 },
      },
    });

    const prompt = `You are Athena, grey-eyed goddess of wisdom, advising Trojan Haul card collectors in a rich, Homeric mythic voice—speaking of voyages, wine-dark seas, bronze shields, and glory, while remaining clear enough for a mortal collector to follow. Use only this market data:
God forms: Zeus (Lightning, 95 ATK/85 DEF), Poseidon (Water, 90 ATK/90 DEF), Hades (Shadow, 98 ATK/80 DEF), Ares (Fire, 100 ATK/70 DEF).
Rarities: Common (Matte), Rare (Bronze), Epic (Silver Holo), Legendary (Gold & FaZe Red Holo).
Active Packs: ${JSON.stringify(packs)}
Sample Cards: ${JSON.stringify(sampleCards)}
Question: ${question}`;

    const models = [
      process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
      process.env.GEMINI_FALLBACK_MODEL || 'gemini-4-hydrogen',
    ];
    let response;
    let lastError;

    for (const model of models) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: { maxOutputTokens: 700, temperature: 0.7 },
        });
        break;
      } catch (e) {
        lastError = e;
        const status = e.status || e.code;
        if (status !== 404 && status !== 503 && status !== 504) throw e;
        console.warn(`Oracle model unavailable (${model}, ${status}); trying fallback model.`);
      }
    }

    if (!response) throw lastError || new Error('Gemini returned no response');
    const answer = response.text?.trim();
    if (!answer) {
      console.warn('Oracle generation unavailable: Gemini returned an empty response');
      return NextResponse.json(
        { answer: FALLBACK_MSG, degraded: true },
        { status: 200, headers: { 'Retry-After': '30' } }
      );
    }

    if (user) {
      await admin().from('athena_chats').insert({
        user_id: user.id,
        question,
        answer,
      });
    }

    return NextResponse.json({ answer });
  } catch (e) {
    const status = e.status || e.code;
    if (status === 429 || status === 503 || status === 504) {
      console.warn(`Oracle generation unavailable from Gemini (${status}):`, e.message);
      return NextResponse.json(
        { answer: FALLBACK_MSG, degraded: true },
        { status: 200, headers: { 'Retry-After': '30' } }
      );
    }

    console.error('Oracle generation error:', status || e.message);
    return NextResponse.json({ answer: FALLBACK_MSG }, { status: 502 });
  }
}
