import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase-admin';

function authorized(req: Request) {
  const expected = process.env.SYNC_API_TOKEN;
  const auth = req.headers.get('authorization') || '';
  return !!expected && auth === `Bearer ${expected}`;
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error:'Unauthorized' }, { status:401 });
  const userId = process.env.SYNC_USER_ID;
  if (!userId) return NextResponse.json({ error:'SYNC_USER_ID missing' }, { status:500 });

  const { pending_id, approved } = await req.json();
  const supabase = createSupabaseAdmin();
  const { data:item, error } = await supabase.from('pending_imports')
    .select('*').eq('id',pending_id).eq('user_id',userId).single();
  if (error || !item) return NextResponse.json({error:error?.message||'Not found'},{status:404});

  if (!approved) {
    await supabase.from('pending_imports').update({status:'rejected',reviewed_at:new Date().toISOString()}).eq('id',pending_id);
    return NextResponse.json({ok:true,status:'rejected'});
  }

  const p = item.payload || {};
  for (const x of p.errors || []) {
    if (!x?.original || !x?.better) continue;
    const {data:old} = await supabase.from('errors').select('*')
      .eq('user_id',userId).eq('original',x.original).eq('better',x.better).maybeSingle();
    if (old) {
      await supabase.from('errors').update({
        occurrence_count:(old.occurrence_count||1)+1,
        last_seen:item.practiced_at,
        next_review:item.practiced_at
      }).eq('id',old.id);
    } else {
      await supabase.from('errors').insert({
        user_id:userId, original:x.original, better:x.better,
        error_type:x.type||'', reason:x.reason||'',
        next_review:item.practiced_at, source:'ChatGPT同步'
      });
    }
  }

  for (const x of p.grammar || []) {
    if (!x?.pattern) continue;
    await supabase.from('grammar').upsert({
      user_id:userId, pattern:x.pattern, meaning:x.meaning||'',
      example:x.example||'', source:'ChatGPT同步', next_review:item.practiced_at
    }, {onConflict:'user_id,pattern'});
  }

  for (const x of [...(p.expressions||[]), ...(p.corpus||[])]) {
    const korean = x.text || x.korean;
    if (!korean) continue;
    await supabase.from('corpus').upsert({
      user_id:userId, korean, chinese:x.meaning||x.chinese||'',
      category:x.category||'ChatGPT同步', status:'semi',
      source:'ChatGPT同步', next_review:item.practiced_at
    }, {onConflict:'user_id,korean'});
  }

  await supabase.from('pending_imports').update({
    status:'approved', reviewed_at:new Date().toISOString()
  }).eq('id',pending_id);

  return NextResponse.json({ok:true,status:'approved'});
}
