-- Supabase SQL Schema for MedPrice AI

-- Users table is handled by Supabase Auth (auth.users), but we can create a public profile table if needed.
-- For simplicity as requested, we will use a 'users' table or just reference auth.users.id
-- Assuming we use Supabase Auth, we extend it with a public users table:
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Search History
CREATE TABLE IF NOT EXISTS public.search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    searched_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Saved Medicines
CREATE TABLE IF NOT EXISTS public.saved_medicines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    saved_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, medicine_name)
);

-- Price Logs (For tracking and graph)
CREATE TABLE IF NOT EXISTS public.price_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicine_name TEXT NOT NULL,
    platform TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Alternatives (Static or cached alternative mappings)
CREATE TABLE IF NOT EXISTS public.alternatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medicine_name TEXT NOT NULL,
    alternative_name TEXT NOT NULL,
    composition TEXT
);

-- Notifications (Price Drop Alerts)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    medicine_name TEXT NOT NULL,
    target_price NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alternatives ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can view own search history" ON public.search_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own search history" ON public.search_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own saved medicines" ON public.saved_medicines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own saved medicines" ON public.saved_medicines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved medicines" ON public.saved_medicines FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Price logs and alternatives are readable by everyone
CREATE POLICY "Price logs are readable by everyone" ON public.price_logs FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert price logs" ON public.price_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Alternatives are readable by everyone" ON public.alternatives FOR SELECT USING (true);

-- Functions
-- Function to handle new user setup automatically when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on sign up
-- Note: Make sure to drop it first if it exists to avoid errors on multiple runs
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
