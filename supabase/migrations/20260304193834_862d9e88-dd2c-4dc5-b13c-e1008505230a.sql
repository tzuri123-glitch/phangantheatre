-- First delete duplicate sessions (keep the oldest one per group)
DELETE FROM public.attendance 
WHERE session_id IN (
  SELECT id FROM public.sessions 
  WHERE id NOT IN (
    SELECT DISTINCT ON (user_id, session_date, class_name) id
    FROM public.sessions
    ORDER BY user_id, session_date, class_name, created_at ASC
  )
);

DELETE FROM public.sessions 
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, session_date, class_name) id
  FROM public.sessions
  ORDER BY user_id, session_date, class_name, created_at ASC
);

-- Now add unique constraint
CREATE UNIQUE INDEX unique_session_per_day 
ON public.sessions (user_id, session_date, class_name);