import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { DAILY_CHAT_PROMPT, INTERVIEW_PROMPT } from '@/lib/prompts';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY 未配置' }, { status: 500 });
  }
  const body = await req.json();
  const mode = body.mode === 'interview' ? 'interview' : 'daily';
  const system = mode === 'interview' ? INTERVIEW_PROMPT : DAILY_CHAT_PROMPT;
  const history = Array.isArray(body.messages) ? body.messages.slice(-24) : [];
  const response = await client.responses.create({
    model: process.env.OPENAI_TEXT_MODEL || 'gpt-5.6-luna',
    instructions: system + (body.questionContext ? `\n本次题目上下文：\n${body.questionContext}` : ''),
    input: history.map((m:any)=>({ role:m.role, content:m.content }))
  });
  return NextResponse.json({ text: response.output_text });
}
