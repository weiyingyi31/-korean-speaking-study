import { NextResponse } from 'next/server';
import { DAILY_CHAT_PROMPT, INTERVIEW_PROMPT } from '@/lib/prompts';

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY 未配置' }, { status: 500 });
  }

  const body = await req.json().catch(()=>({}));
  const mode = body.mode === 'interview' ? 'interview' : 'daily';
  const questionContext = body.questionContext ? `\n本次面试题上下文：\n${body.questionContext}` : '';
  const instructions = (mode === 'interview' ? INTERVIEW_PROMPT : DAILY_CHAT_PROMPT) + questionContext;

  const r = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      session: {
        type: 'realtime',
        model: process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2.1-mini',
        instructions,
        audio: {
          output: { voice: process.env.OPENAI_REALTIME_VOICE || 'marin' }
        }
      }
    })
  });

  const text = await r.text();
  if (!r.ok) {
    return NextResponse.json({ error: text }, { status: r.status });
  }
  return new NextResponse(text, { headers: { 'Content-Type':'application/json' } });
}
