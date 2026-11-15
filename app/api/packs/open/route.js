import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { admin } from '@/lib/server';

export async function POST(req) {
  try {
    const { packId } = await req.json();
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
    }

    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { data, error } = await admin().rpc('open_card_pack', {
      p_pack_id: Number(packId),
      p_user_id: user.id,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, result: data });
  } catch (e) {
    console.error('Pack open error:', e);
    return NextResponse.json({ error: 'Failed to open pack' }, { status: 500 });
  }
}
