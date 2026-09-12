
create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz default now()
);

create table if not exists vocabulary (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  term text not null,
  zh text,
  category text,
  source text,
  learned_at date,
  mastery text default 'learning',
  last_review date,
  next_review date,
  created_at timestamptz default now(),
  unique(user_id, term)
);

create table if not exists vocabulary_examples (
  id uuid primary key default gen_random_uuid(),
  vocabulary_id uuid not null references vocabulary(id) on delete cascade,
  korean text not null,
  chinese text,
  source text,
  created_at timestamptz default now()
);

create table if not exists corpus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  korean text not null,
  chinese text,
  category text,
  status text default 'passive',
  use_count int default 0,
  last_review date,
  next_review date,
  source text,
  created_at timestamptz default now()
);

create table if not exists errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original text not null,
  better text not null,
  error_type text,
  reason text,
  occurrence_count int default 1,
  last_seen date default current_date,
  next_review date,
  created_at timestamptz default now()
);

create table if not exists grammar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pattern text not null,
  meaning text,
  example text,
  status text default 'learning',
  next_review date,
  source text,
  created_at timestamptz default now()
);

create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text,
  day_tag text,
  korean text not null,
  chinese text,
  framework jsonb default '[]'::jsonb,
  sample_answer text,
  mastery text default 'learning',
  next_review date,
  source text,
  created_at timestamptz default now()
);

create table if not exists practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null,
  started_at timestamptz default now(),
  ended_at timestamptz,
  duration_seconds int,
  analysis_status text default 'pending'
);

create table if not exists practice_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references practice_sessions(id) on delete cascade,
  role text not null check(role in ('user','assistant')),
  content text not null,
  created_at timestamptz default now()
);

create table if not exists practice_analysis (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references practice_sessions(id) on delete cascade,
  result jsonb not null,
  approved boolean default false,
  created_at timestamptz default now()
);

create table if not exists daily_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_date date not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  unique(user_id, task_date)
);

create table if not exists media_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text,
  minutes int default 0,
  no_subtitles boolean default false,
  practiced_at date default current_date
);

alter table vocabulary enable row level security;
alter table corpus enable row level security;
alter table errors enable row level security;
alter table grammar enable row level security;
alter table questions enable row level security;
alter table practice_sessions enable row level security;
alter table practice_messages enable row level security;
alter table practice_analysis enable row level security;
alter table daily_tasks enable row level security;
alter table media_sessions enable row level security;

create policy "own vocabulary" on vocabulary for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own corpus" on corpus for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own errors" on errors for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own grammar" on grammar for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own questions" on questions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own sessions" on practice_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own daily tasks" on daily_tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own media" on media_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own messages through session" on practice_messages
for all using (
  exists(select 1 from practice_sessions s where s.id = session_id and s.user_id = auth.uid())
) with check (
  exists(select 1 from practice_sessions s where s.id = session_id and s.user_id = auth.uid())
);

create policy "own analyses through session" on practice_analysis
for all using (
  exists(select 1 from practice_sessions s where s.id = session_id and s.user_id = auth.uid())
) with check (
  exists(select 1 from practice_sessions s where s.id = session_id and s.user_id = auth.uid())
);


-- V1.6 indexes / dedupe helpers
create unique index if not exists corpus_user_korean_unique
  on corpus(user_id, korean);

create unique index if not exists grammar_user_pattern_unique
  on grammar(user_id, pattern);

create unique index if not exists question_user_korean_unique
  on questions(user_id, korean);

create index if not exists vocabulary_next_review_idx on vocabulary(user_id, next_review);
create index if not exists corpus_next_review_idx on corpus(user_id, next_review);
create index if not exists errors_next_review_idx on errors(user_id, next_review);
create index if not exists questions_next_review_idx on questions(user_id, next_review);


-- V1.8: weekly active corpus + formal mock interview
create table if not exists weekly_corpus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  corpus_id uuid not null references corpus(id) on delete cascade,
  priority int default 1,
  created_at timestamptz default now(),
  unique(user_id, week_start, corpus_id)
);

create table if not exists mock_interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz default now(),
  ended_at timestamptz,
  question_ids jsonb not null default '[]'::jsonb,
  current_index int default 0,
  completed boolean default false
);

alter table weekly_corpus enable row level security;
alter table mock_interviews enable row level security;

create policy "own weekly corpus" on weekly_corpus
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own mock interviews" on mock_interviews
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists weekly_corpus_week_idx on weekly_corpus(user_id, week_start);


-- V1.9: ChatGPT / external sync pending review queue
create table if not exists pending_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references practice_sessions(id) on delete cascade,
  source text default 'chatgpt',
  practice_type text,
  practiced_at date default current_date,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  created_at timestamptz default now(),
  reviewed_at timestamptz
);

alter table pending_imports enable row level security;

create policy "own pending imports" on pending_imports
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists pending_imports_user_status_idx
  on pending_imports(user_id, status, created_at desc);
