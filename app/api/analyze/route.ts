import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { STUDENT_CONTEXT } from '@/lib/prompts';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY 未配置' }, { status: 500 });
  }
  const { transcript, mode } = await req.json();

  const response = await client.responses.create({
    model: process.env.OPENAI_TEXT_MODEL || 'gpt-5.6-luna',
    instructions: STUDENT_CONTEXT + `
你正在分析一次韩语${mode === 'interview' ? '面试' : '日常口语'}练习。
要求：
1. 只提取真正值得复习的内容，不凑数量。
2. 错误只记录用户真实说错、搭配不自然或明显影响表达的内容；正确句子不要列为错误。
3. 可积累语法必须来自本次真实对话，且适合用户当前口语水平。
4. 共用语料优先选择能迁移到其他日常话题或面试题的表达。
5. 保留用户原意，优先给自然、简短、可直接用于口语的韩语。
6. 面试模式额外评价：框架完整度、是否偏题、表达流畅度建议。
请只返回JSON，不要Markdown：
{
  "summary":"",
  "interview_feedback":{"framework":"","relevance":"","fluency":""},
  "errors":[{"original":"","better":"","type":"","reason":""}],
  "grammar":[{"pattern":"","meaning":"","example":""}],
  "expressions":[{"text":"","meaning":"","example":""}],
  "corpus":[{"text":"","meaning":"","category":""}]
}`,
    input: String(transcript || '')
  });

  let text = response.output_text.trim().replace(/^```json\s*/,'').replace(/```$/,'');
  try {
    return NextResponse.json(JSON.parse(text));
  } catch {
    return NextResponse.json({ raw: text });
  }
}
