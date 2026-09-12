import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

function authorized(req: Request) {
  const expected = process.env.SYNC_API_TOKEN;
  if (!expected) return false;
  const auth = req.headers.get('authorization') || '';
  const xToken = req.headers.get('x-sync-token') || '';
  return auth === `Bearer ${expected}` || xToken === expected;
}

function normalizeMessages(transcript: unknown) {
  if (Array.isArray(transcript)) {
    return transcript
      .filter((x:any)=>x && typeof x.content === 'string')
      .map((x:any)=>({
        role: x.role === 'assistant' ? 'assistant' : 'user',
        content: x.content.trim()
      }))
      .filter((x:any)=>x.content);
  }
  const text = String(transcript || '').trim();
  if (!text) return [];
  return [{ role: 'user', content: text }];
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = process.env.SYNC_USER_ID;
  if (!userId) {
    return NextResponse.json({ error: 'SYNC_USER_ID is not configured' }, { status: 500 });
  }

  const body = await req.json();
  const supabase = createSupabaseAdmin();

  const practiceType = body.type || body.practice_type || 'daily_conversation';
  const practicedAt = body.date || new Date().toISOString().slice(0,10);
  const messages = normalizeMessages(body.transcript || body.messages);

  const { data: session, error: sessionError } = await supabase
    .from('practice_sessions')
    .insert({
      user_id: userId,
      mode: practiceType,
      started_at: body.started_at || new Date().toISOString(),
      ended_at: body.ended_at || new Date().toISOString(),
      duration_seconds: body.duration_seconds || ((body.duration_minutes || 0) * 60),
      analysis_status: 'synced'
    })
    .select('id')
    .single();

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  if (messages.length) {
    const rows = messages.map((m:any)=>({
      session_id: session.id,
      role: m.role,
      content: m.content
    }));
    const { error } = await supabase.from('practice_messages').insert(rows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const payload = {
    summary: body.summary || '',
    question_id: body.question_id || null,
    question: body.question || null,
    performance: body.performance || null,
    errors: Array.isArray(body.errors) ? body.errors : [],
    grammar: Array.isArray(body.grammar) ? body.grammar : [],
    expressions: Array.isArray(body.expressions) ? body.expressions : [],
    corpus: Array.isArray(body.corpus) ? body.corpus : [],
    notes: body.notes || '',
    source_chat_title: body.source_chat_title || '',
    source: body.source || 'chatgpt'
  };

  const { data: pending, error: pendingError } = await supabase
    .from('pending_imports')
    .insert({
      user_id: userId,
      session_id: session.id,
      source: body.source || 'chatgpt',
      practice_type: practiceType,
      practiced_at: practicedAt,
      payload
    })
    .select('id,status')
    .single();

  if (pendingError) {
    return NextResponse.json({ error: pendingError.message }, { status: 500 });
  }

  // Safe automatic update for a linked interview question:
  // only scheduling metadata is updated; AI-generated learning content still waits for approval.
  if (body.question_id && body.performance?.rating) {
    const rating = Number(body.performance.rating);
    const days = rating <= 1 ? 1 : rating === 2 ? 2 : rating === 3 ? 5 : 14;
    const d = new Date();
    d.setDate(d.getDate() + days);
    const mastery = rating >= 4 ? 'mastered' : rating === 3 ? 'good' : 'learning';
    await supabase.from('questions').update({
      mastery,
      last_review: practicedAt,
      next_review: d.toISOString().slice(0,10)
    }).eq('id', body.question_id).eq('user_id', userId);
  }

  return NextResponse.json({
    ok: true,
    session_id: session.id,
    pending_import_id: pending.id,
    status: 'pending_review'
  });
}
