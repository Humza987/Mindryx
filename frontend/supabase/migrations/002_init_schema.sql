-- Drop existing tables (this will delete all data—back up if needed!)
drop table if exists results;
drop table if exists quizzes;

-- Enable UUID extension (still needed for id columns)
create extension if not exists "uuid-ossp";

-- Quizzes table (user_id now text with default from JWT sub)
create table quizzes (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null default auth.jwt() ->> 'sub',
  topic text not null,
  difficulty text default 'medium',
  quiz jsonb not null,
  created_at timestamptz default now()
);

-- Results table (user_id now text with default from JWT sub)
create table results (
  id uuid primary key default uuid_generate_v4(),
  user_id text not null default auth.jwt() ->> 'sub',
  quiz_id uuid not null references quizzes(id),
  answers jsonb not null,
  score int not null,
  total_questions int not null,
  percentage numeric(5,2) not null,
  submitted_at timestamptz default now()
);

-- Enable RLS
alter table quizzes enable row level security;
alter table results enable row level security;


-- Drop old policies if they exist
drop policy if exists "Users can read own quizzes" on quizzes;
drop policy if exists "Users can insert own quizzes" on quizzes;
drop policy if exists "Users can read own results" on results;
drop policy if exists "Users can insert own results" on results;

-- New RLS policies
create policy "Users can read own quizzes" on quizzes for select
  using (auth.jwt() ->> 'sub' = user_id);

create policy "Users can insert own quizzes" on quizzes for insert
  with check (auth.jwt() ->> 'sub' = user_id);

create policy "Users can read own results" on results for select
  using (auth.jwt() ->> 'sub' = user_id);

create policy "Users can insert own results" on results for insert
  with check (auth.jwt() ->> 'sub' = user_id);