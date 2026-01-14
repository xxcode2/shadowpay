-- Drop old table if exists (to start fresh)
DROP TABLE IF EXISTS public.payment_links CASCADE;

-- Create payment_links table for persistent storage
CREATE TABLE public.payment_links (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  amount TEXT,
  token TEXT DEFAULT 'SOL',
  anyAmount BOOLEAN DEFAULT false,
  amountType TEXT DEFAULT 'fixed',
  linkUsageType TEXT DEFAULT 'reusable',
  url TEXT,
  status TEXT DEFAULT 'created',
  paid BOOLEAN DEFAULT false,
  commitment TEXT,
  txHash TEXT,
  paidAt BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  payment_count INTEGER DEFAULT 0
);

-- Create indexes for faster queries
CREATE INDEX idx_payment_links_creator_id ON public.payment_links(creator_id);
CREATE INDEX idx_payment_links_paid ON public.payment_links(paid);

-- Enable Row Level Security
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read (metadata is public)
CREATE POLICY "Allow public read" ON public.payment_links
  FOR SELECT USING (true);

-- Create policy to allow anyone to insert
CREATE POLICY "Allow anyone to insert" ON public.payment_links
  FOR INSERT WITH CHECK (true);

-- Create policy to allow updates
CREATE POLICY "Allow updates" ON public.payment_links
  FOR UPDATE USING (true) WITH CHECK (true);
