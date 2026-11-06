-- ============================================================================
-- DEVHOST CLOUD — FOUNDER ADMIN PROMOTION SCRIPT
-- Run this in Supabase SQL Editor after signing up with your real email on /register:
-- ============================================================================

UPDATE public.profiles
SET role = 'admin'
WHERE email = 'mohammadbitullah@gmail.com';

-- Verify the promotion status:
SELECT id, full_name, email, role, wallet_balance_bdt, created_at
FROM public.profiles
WHERE email = 'mohammadbitullah@gmail.com';
