# Supabase Setup Guide

## Error: "Supabase not configured"

If you see this error when creating payment links, you need to configure Supabase.

## Quick Setup (5 minutes)

### Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Click **"New Project"**
3. Choose a name (e.g., "shadowpay")
4. Set password
5. Select region closest to you
6. Click **Create**

### Step 2: Get API Credentials
1. Project created → Go to **Settings > API**
2. Copy these values:
   - **Project URL** (e.g., `https://abc123.supabase.co`)
   - **Anon Key** (the `anon` public key)

### Step 3: Configure Environment
1. Edit `.env.development`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

2. Replace with your actual values from Step 2

### Step 4: Restart Development Server
```bash
npm run dev
```

### Step 5: Create Database Table (Optional but Recommended)

Run this SQL in Supabase SQL Editor:

```sql
-- Create payment_links table
CREATE TABLE IF NOT EXISTS payment_links (
  id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  token TEXT DEFAULT 'SOL',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  claimed BOOLEAN DEFAULT FALSE,
  claimed_by TEXT,
  claimed_at TIMESTAMP
);

-- Enable Row Level Security
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (create links)
CREATE POLICY "Anyone can create links"
  ON payment_links FOR INSERT 
  WITH CHECK (true);

-- Allow anyone to read
CREATE POLICY "Anyone can read links"
  ON payment_links FOR SELECT 
  USING (true);

-- Allow anyone to update (claim links)
CREATE POLICY "Anyone can update links"
  ON payment_links FOR UPDATE 
  USING (true);
```

## Testing

### Without Supabase (Demo Mode)
If you don't configure Supabase, the app shows an error when trying to create links. All other features (wallet connection, transactions) work fine.

### With Supabase
Once configured, payment link history will be saved and you can:
- View all created links
- Track claimed links
- See creation timestamps
- Filter by recipient

## Troubleshooting

### Still getting "Supabase not configured"?
1. Check `.env.development` has both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
2. Restart dev server: `npm run dev`
3. Hard refresh browser: `Ctrl+Shift+R` (or Cmd+Shift+R on Mac)

### Connection refused?
1. Check your Project URL is correct
2. Verify Anon Key is not the `service_role` key (should be `anon` key)
3. Check network connectivity

### Links not saving?
1. Table might not exist - run the SQL from Step 5
2. Check browser console for errors
3. Verify Supabase credentials are correct

## Backend Configuration

For the backend server (`server/index.js`), Supabase is optional. The backend can:
- Work with in-memory storage (links.json) - requires no config
- Work with Supabase for persistent storage - requires env vars:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

## Production Setup

For production, use Supabase with:
1. **Enable RLS** (Row Level Security) on all tables
2. **Set up auth policies** to restrict who can access data
3. **Use service role key** for backend operations (not anon key)
4. **Configure CORS** in Supabase Auth settings to match your domain

## Need Help?

- Supabase Docs: https://supabase.com/docs
- ShadowPay Docs: See README.md
- Report issues: Check GitHub issues
