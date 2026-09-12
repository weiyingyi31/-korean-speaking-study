# 韩语口语学习系统 · 云端版 V1.9

这一版已经把核心数据闭环真正接起来：

## 已完成
- Supabase 邮箱 Magic Link 登录
- 同一账号手机/电脑云端同步
- 一键导入已有历史学习资料，并按主键/表达去重
- 现有资料来源：
  - `文本.txt`：主题分类和题库骨架
  - 《韩语每日学习材料》：专业词汇、例句、中译韩
  - 《韩语口语练习总结》：错误与口语表达
  - 《韩国大学院面试口语练习 2》：面试题、框架、回答
- 每日任务自动生成并写入 `daily_tasks`
- 专业词汇 / 中译韩按今日任务学习
- 面试题从云端题库读取
- 网站内 OpenAI 文字对话
- 每一句用户/AI对话自动写入 `practice_messages`
- 结束后调用 AI 复盘
- AI复盘逐条勾选审核
- 审核后的错误、语法、表达、共用语料自动写入云端并去重
- 错误重复出现时累加 occurrence_count
- 今日复习队列根据 `next_review`、语料状态和题库状态自动生成

## 还没有做
- OpenAI Realtime 实时语音（下一步）
- 浏览器语音转写/AI语音回复
- 完整的资料库搜索和编辑器
- 更细的“主动语料自动升级”规则
- Vercel Cron 每天凌晨预生成任务（现在是登录/打开时生成）

## 安装

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

## Supabase
1. 创建 Supabase 项目
2. SQL Editor 执行 `supabase/schema.sql`
3. Authentication → Providers → Email 保持启用
4. 设置 Site URL 为你的 Vercel 网站地址
5. `.env.local` 或 Vercel Environment Variables：

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_TEXT_MODEL=gpt-5.6-luna
```

## 第一次登录
登录后首页如果数据库为空，会出现：

**“导入我的历史学习资料”**

点击一次即可把当前已整理数据写入自己的账号数据库。

## 数据安全
- OpenAI API Key 只在服务器环境变量中使用。
- Supabase 开启 RLS；用户只能读取/写入自己的数据。
- 网站内对话消息保存在自己的 Supabase 项目中。

## 下一阶段
V1.7 将重点接 OpenAI Realtime：
麦克风 → 实时听韩语 → AI韩语语音回复 → 自动转写 → 同一 practice_session 保存 → 结束后复盘。


# V1.7 新增：Realtime 实时韩语语音

## 已接入
- 日常对话：实时麦克风输入 + AI韩语语音回复
- 面试模式：按当前题库题目直接语音提问
- Realtime 转写自动进入 practice_messages
- 结束语音后走和文字练习相同的 AI复盘 → 审核 → 入库流程
- OpenAI API Key 不暴露到浏览器：服务器先生成短期 Realtime client secret
- 浏览器通过 WebRTC 连接 Realtime API

## 新环境变量
```env
OPENAI_REALTIME_MODEL=gpt-realtime-2.1-mini
OPENAI_REALTIME_VOICE=marin
```

## Safari 注意
1. 网站必须通过 HTTPS 部署（Vercel 默认满足）。
2. 第一次点“实时语音”时允许麦克风权限。
3. 如果此前拒绝过权限，请在 Safari 网站设置中重新允许麦克风。
4. Realtime 属于 OpenAI API 单独计费，与 ChatGPT Plus 订阅分开。

## 当前下一步
- 完整资料库搜索/编辑
- 每周主动语料池
- 更准确地统计主动语料调用次数
- 正式模拟面试的“整组题目逐题提问”模式


# V1.8 新增

## 正式模拟面试
- 从云端题库随机抽取最多6题
- 逐题作答
- 中途不显示框架、不即时纠错
- 最后一题结束后统一AI复盘
- `mock_interviews` 保存本次题组和进度

## 完整资料库
现在支持统一搜索和分类筛选：
- 专业词汇
- 个人语料
- 错误
- 语法
- 面试题

并支持基础编辑与删除。

## 每周主动语料池
- 新增 `weekly_corpus`
- 每周可生成最多20条非主动语料
- 首页直接显示本周目标表达
- 在今日复习中把语料评为“熟练”时，会进入主动化流程

## 下一阶段
- 正式模拟面试加入Realtime语音逐题切换
- 自动统计语料实际使用次数
- 日常AI对话有意识创造本周目标语料的使用机会
- 周报：主动语料、高频错误、面试掌握率、口语时长


# V1.9 新增：ChatGPT → 网站自动同步

## 核心变化
这一版把网站定位调整为：

- ChatGPT：主要口语练习场
- 网站：学习数据库、复习系统、题库、语料库、错误库

网站内 Realtime 语音功能保留为备用，不再作为主要训练方式。

## 新增 API
`POST /api/sync-practice`

练习结束后，ChatGPT / 自定义 GPT Action 可以把：
- 完整练习记录
- 练习日期与类型
- 面试题表现
- 错误
- 语法
- 可积累表达
- 共用语料

同步进网站。

练习记录会直接保存到 `practice_sessions` / `practice_messages`。
AI提取的错误、语法和语料先进入 `pending_imports`，必须审核后才正式入库。

## 新增待审核区
首页会显示 ChatGPT 同步过来的待审核练习。
可选择：
- 批准入库
- 忽略

## 配置
新增两个服务器环境变量：

```env
SYNC_API_TOKEN=请设置一个很长的随机字符串
SYNC_USER_ID=你的Supabase auth.users用户UUID
```

`SYNC_API_TOKEN` 不要写在前端代码或公开仓库。

## ChatGPT Action
项目中包含：

`docs/chatgpt-action-openapi.yaml`

部署完成后：
1. 把 YAML 里的 `YOUR-VERCEL-DOMAIN` 改成你的真实 Vercel 域名。
2. 在自定义 GPT / Action 配置里导入这份 OpenAPI Schema。
3. 认证方式使用 Bearer API Key。
4. API Key 值填写与 Vercel 的 `SYNC_API_TOKEN` 相同。

之后在练习结束时说：
“结束今天的练习并同步到我的韩语学习网站。”

Action 即可调用 `/api/sync-practice`。

## 同步原则
- 完整练习记录：自动保存
- 题目复习时间/掌握度：有明确 rating 时可自动更新
- 错误/语法/新语料：进入 Pending，审核后入库
- 避免AI误判污染长期语料库
