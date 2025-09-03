-- Fixed function to increment quiz count per user-specific month
create or replace function increment_quiz_count() returns trigger as $$
declare
    month_start date;
    first_quiz_date date;
    days_diff integer;
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
        days_diff := new.created_at::date - first_quiz_date;
        month_start := first_quiz_date + (floor(days_diff / 30) * 30);
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