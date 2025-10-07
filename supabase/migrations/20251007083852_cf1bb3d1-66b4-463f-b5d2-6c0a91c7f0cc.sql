-- Create profiles table for user data
CREATE TABLE public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  created_at timestamp with time zone default now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create students table
CREATE TABLE public.students (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  phone text,
  birth_date date,
  parent_name text,
  parent_phone text,
  is_sibling boolean default false,
  class_name text not null,
  status text check (status in ('חדש', 'פעיל', 'בהקפאה', 'בהמתנה')) default 'חדש',
  created_at timestamp with time zone default now()
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own students"
  ON public.students FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own students"
  ON public.students FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own students"
  ON public.students FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own students"
  ON public.students FOR DELETE
  USING (auth.uid() = user_id);

-- Create subscriptions table (monthly cards with 4 entries)
CREATE TABLE public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  student_id uuid references public.students(id) on delete cascade not null,
  month_year text not null, -- format: "YYYY-MM"
  entries_remaining integer default 4,
  total_entries integer default 4,
  created_at timestamp with time zone default now(),
  unique(student_id, month_year)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- Create sessions table
CREATE TABLE public.sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  class_name text not null,
  session_date date not null,
  is_trial boolean default false,
  created_at timestamp with time zone default now()
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON public.sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
  ON public.sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON public.sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
  ON public.sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Create attendance table
CREATE TABLE public.attendance (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  session_id uuid references public.sessions(id) on delete cascade not null,
  student_id uuid references public.students(id) on delete cascade not null,
  status text check (status in ('נוכח', 'לא הגיע', 'לא באי')) not null,
  created_at timestamp with time zone default now(),
  unique(session_id, student_id)
);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own attendance"
  ON public.attendance FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own attendance"
  ON public.attendance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attendance"
  ON public.attendance FOR UPDATE
  USING (auth.uid() = user_id);

-- Create payments table
CREATE TABLE public.payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  student_id uuid references public.students(id) on delete cascade not null,
  payment_type text check (payment_type in ('ניסיון', 'חד פעמי', 'חודשי')) not null,
  payment_method text check (payment_method in ('מזומן', 'סקאן')) not null,
  payment_date date not null,
  amount numeric not null,
  note text,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  created_at timestamp with time zone default now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payments"
  ON public.payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payments"
  ON public.payments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payments"
  ON public.payments FOR DELETE
  USING (auth.uid() = user_id);