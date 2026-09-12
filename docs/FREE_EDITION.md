# 免费版说明

此版本不调用 OpenAI API，因此无需填写：
- OPENAI_API_KEY
- OPENAI_TEXT_MODEL
- OPENAI_REALTIME_MODEL
- OPENAI_REALTIME_VOICE

保留功能：
- Supabase 云端登录与同步
- 专业词汇 / 中译韩
- 面试题库
- 错误、语法、个人语料库
- 今日复习 / next_review
- 每周主动语料池
- ChatGPT → 网站 /api/sync-practice
- 待审核区
- 资料库搜索与编辑

AI 与语音练习继续在 ChatGPT 中完成。

Vercel 必填环境变量：
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SYNC_API_TOKEN
SYNC_USER_ID（第一次登录网站后再填）
