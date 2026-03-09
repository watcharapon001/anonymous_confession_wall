-- Create Confessions Table
CREATE TABLE public.confessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create Likes Table
CREATE TABLE public.likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  confession_id UUID NOT NULL REFERENCES public.confessions(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  UNIQUE(confession_id, session_id)
);

-- Create Comments Table
CREATE TABLE public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  confession_id UUID NOT NULL REFERENCES public.confessions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create Reports Table
CREATE TABLE public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  confession_id UUID NOT NULL REFERENCES public.confessions(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS (Row Level Security) - Allowing generic anon usage for MVP
ALTER TABLE public.confessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Create Policies allowing all operations for anonymous users (MVP version)
-- For production, you may want to restrict deletes/updates.
CREATE POLICY "Allow anon select on confessions" ON public.confessions FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on confessions" ON public.confessions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on confessions" ON public.confessions FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anon delete on confessions" ON public.confessions FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select on likes" ON public.likes FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on likes" ON public.likes FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon select on comments" ON public.comments FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on comments" ON public.comments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon delete on comments" ON public.comments FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select on reports" ON public.reports FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on reports" ON public.reports FOR INSERT TO anon WITH CHECK (true);

-- Turn on Realtime for confessions and comments
alter publication supabase_realtime add table public.confessions;
alter publication supabase_realtime add table public.comments;


-- Create RPC function to increment likes
CREATE OR REPLACE FUNCTION public.increment_like(confession_uid UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.confessions
  SET likes_count = likes_count + 1
  WHERE id = confession_uid;
END;
$$ LANGUAGE plpgsql;

-- Create RPC function to decrement likes
CREATE OR REPLACE FUNCTION public.decrement_like(confession_uid UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.confessions
  SET likes_count = GREATEST(0, likes_count - 1)
  WHERE id = confession_uid;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to auto-increment comments_count
CREATE OR REPLACE FUNCTION public.increment_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.confessions
  SET comments_count = comments_count + 1
  WHERE id = NEW.confession_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to comments table
CREATE TRIGGER on_comment_insert
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.increment_comment_count();
