-- Create user_quiz_stats table
create table if not exists user_quiz_stats (
    user_id text not null,
    month_start_date date not null,
    quiz_count int default 0,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    primary key (user_id, month_start_date)
);

-- Enable RLS for user_quiz_stats
alter table user_quiz_stats enable row level security;

-- RLS policy for user_quiz_stats
create policy "Users can read own quiz stats" on user_quiz_stats for select
  using (auth.jwt() ->> 'sub' = user_id);

create policy "Users can update own quiz stats" on user_quiz_stats for all
  using (auth.jwt() ->> 'sub' = user_id);

-- Function to increment quiz count per user-specific month
create or replace function increment_quiz_count() returns trigger as $$
declare
    month_start date;
    first_quiz_date date;
begin
    -- Get the user's first quiz date (excluding the current one being inserted)
    select min(created_at)::date 
    into first_quiz_date
    from quizzes 
    where user_id = new.user_id and id != new.id;
    
    -- If this is the first quiz, use its date as the starting point
    if first_quiz_date is null then
        month_start := new.created_at::date;
    else
        -- Compute the user-specific month start (rolling 30-day month from first quiz)
        month_start := first_quiz_date + (floor(extract(days from (new.created_at::date - first_quiz_date))/30) * 30);
    end if;
    
    -- Insert or update quiz count
    insert into user_quiz_stats (user_id, month_start_date, quiz_count, updated_at)
    values (new.user_id, month_start, 1, now())
    on conflict (user_id, month_start_date)
    do update set 
        quiz_count = user_quiz_stats.quiz_count + 1,
        updated_at = now();
    
    return new;
end;
$$ language plpgsql;

-- Create index for better performance
create index if not exists idx_quizzes_user_created 
on quizzes (user_id, created_at);

-- Trigger to call the function after a quiz is inserted
drop trigger if exists trigger_increment_quiz_count on quizzes;
create trigger trigger_increment_quiz_count
after insert on quizzes
for each row
execute function increment_quiz_count();