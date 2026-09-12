import { NextResponse } from 'next/server';
export async function POST(req: Request) {
  const body = await req.json().catch(()=>({}));
  const counts = body.counts || {};
  return NextResponse.json({
    date: new Date().toISOString().slice(0,10),
    vocabulary: 10,
    translation: 15,
    newInterviewQuestions: 2,
    reviewInterviewQuestions: Math.min(6, Math.max(2, counts.dueQuestions || 4)),
    note: '正式版会根据 Supabase 中 next_review、mastery、错误频率和语料状态动态生成。'
  });
}
