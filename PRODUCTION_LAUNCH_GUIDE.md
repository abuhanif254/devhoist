# 🚀 DEVHOST CLOUD PLATFORM - PRODUCTION BACKEND LAUNCH GUIDE (PHASE 10)

এই গাইডের মাধ্যমে আপনি আপনার **DevHost Cloud Platform**-কে ক্লাউডফ্লেয়ার, সুপাবেস (Supabase PostgreSQL), এবং আসল WHM/cPanel রিসেলার সার্ভারের সাথে সংযুক্ত করে শতভাগ অটোমেটেড প্রোডাকশন প্ল্যাটফর্মে রূপান্তর করতে পারবেন।

---

## ১. সুপাবেস ডাটাবেস সেটআপ (Supabase PostgreSQL & Auth)

### ধাপ ১: প্রজেক্ট তৈরি
1. [supabase.com](https://supabase.com)-এ গিয়ে একটি ফ্রি/প্রো একাউন্ট খুলুন এবং **New Project** তৈরি করুন (যেমন: `devhost-cloud-db`)।
2. ডেটাবেস রিজিয়ন হিসেবে **Singapore (ap-southeast-1)** সিলেক্ট করুন (যাতে বাংলাদেশ থেকে সর্বনিম্ন লেটেন্সি পাওয়া যায়)।

### ধাপ ২: ডাটাবেস স্কিমা এক্সিকিউশন
1. সুপাবেস ড্যাশবোর্ডের বাম পাশের মেনু থেকে **SQL Editor**-এ যান।
2. **New Query**-তে ক্লিক করুন।
3. আমাদের রিপোজিটরির [`supabase/schema.sql`](file:///c:/Next%20Project/hosting/supabase/schema.sql) ফাইলের সম্পূর্ণ কোড কপি করে SQL Editor-এ পেস্ট করুন এবং **Run** চাপুন।
4. এতে ৮টি প্রোডাকশন টেবিল (`profiles`, `hosting_services`, `domains`, `invoices`, `transactions`, `support_tickets`, `ticket_messages`, `migration_requests`, `platform_settings`), রো-লেভেল সিকিউরিটি (RLS) পলিসি এবং স্বয়ংক্রিয় প্রোফাইল তৈরির ট্রিগার প্রস্তুত হয়ে যাবে।

### ধাপ ৩: API Keys সংগ্রহ
- সুপাবেস ড্যাশবোর্ডের **Project Settings** $\rightarrow$ **API**-তে যান:
  - `Project URL` $\rightarrow$ `NEXT_PUBLIC_SUPABASE_URL`
  - `Project API keys (anon / public)` $\rightarrow$ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `Project API keys (service_role / secret)` $\rightarrow$ `SUPABASE_SERVICE_ROLE_KEY`

---

## ২. আসল WHM / cPanel রিসেলার ইন্টিগ্রেশন (WHM JSON API & 1-Click SSO)

আমাদের প্ল্যাটফর্ম সরাসরি WHM JSON API 1 এর সাথে স্ট্যান্ডার্ড HTTP/HTTPS ফেচের মাধ্যমে যোগাযোগ করে।

### ধাপ ১: WHM API Token তৈরি
1. আপনার রিসেলার WHM প্যানেলে লগইন করুন (যেমন: `https://sg1.yourserver.com:2087`)।
2. সার্চ বারে টাইপ করুন: **Manage API Tokens**।
3. **Generate Token**-এ ক্লিক করুন:
   - **Token Name:** `devhost-cloud-api`
   - **Permissions:** টিক দিন `Account Creation (createacct)`, `Account Suspension (suspendacct/unsuspendacct)`, `List Accounts (listaccts)`, এবং `User Session / SSO (create_user_session)`।
4. জেনারেট হওয়া সিক্রেট টোকেনটি কপি করুন।

### ধাপ ২: এনভায়রনমেন্ট ভেরিয়েবল
- `WHM_HOST`: আপনার সার্ভার হোস্টনেম বা আইপি (যেমন: `sg1.yourdomain.com` অথবা `103.151.102.45` — কোনো `https://` ছাড়া)।
- `WHM_USERNAME`: আপনার WHM রিসেলার ইউজারনেম।
- `WHM_API_TOKEN`: ধাপ ১-এ পাওয়া টোকেন।

### ৩টি মূল ফিচার যা সরাসরি সচল হবে:
1. **অটোমেটিক সিপ্যানেল তৈরি:** কাস্টমার পেমেন্ট করা মাত্রই `/api/payments/webhook` স্বয়ংক্রিয়ভাবে WHM-এ কল করে ৩ সেকেন্ডে সিপ্যানেল তৈরি করে দেবে।
2. **১-ক্লিক পাসওয়ার্ডলেস সিপ্যানেল লগইন:** কাস্টমার ড্যাশবোর্ডের `1-Click cPanel SSO ↗` বাটনে চাপ দিলে `/api/whm/sso` এন্ডপয়েন্ট ওয়ান-টাইম সিকিউরিটি টোকেন ইউআরএল তৈরি করে পাসওয়ার্ড ছাড়াই সিপ্যানেল ওপেন করবে।
3. **রিসেলার ওয়াচডগ সিঙ্ক:** অ্যাডমিন সেন্টারের `Sync Live WHM` বাটনে ক্লিক করলে রিয়েল-টাইমে সার্ভারের আসল ডিস্ক স্পেস ও সক্রিয় অ্যাকাউন্টের সংখ্যা সিঙ্ক হবে।

---

## ৩. লাইভ পেমেন্ট গেটওয়ে সেটআপ (bKash, Nagad, UddoktaPay)

### অপশন ক: UddoktaPay (সুপার-ফাস্ট অল-ইন-ওয়ান গেটওয়ে)
সবচেয়ে দ্রুত ও সহজে এক এপিআই-তেই বিকাশ, নগদ, রকেট এবং কার্ড চালু করার জন্য:
1. [uddoktapay.com](https://uddoktapay.com)-এ একাউন্ট খুলে আপনার API Key সংগ্রহ করুন।
2. ভেরিয়েবল দিন:
   - `UDDOKTAPAY_API_KEY`: আপনার কী
   - `UDDOKTAPAY_API_URL`: `https://pay.uddoktapay.com/api/checkout-v2`
3. Webhook URL সেট করুন: `https://devhoist.pages.dev/api/payments/webhook`

### অপশন খ: বিকাশ মার্চেন্ট টোকেনাইজড এপিআই (Direct bKash)
- `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD`

> [!NOTE]
> কোনো গেটওয়ে কী না বসানো থাকলেও আমাদের প্ল্যাটফর্ম ক্র্যাশ করবে না; স্বয়ংক্রিয়ভাবে **Sandbox Simulation Mode**-এ ইনস্ট্যান্ট ভেরিফিকেশন ও ডিমো প্রোভিশনিং এক্সিকিউট করবে।

---

## ৪. ক্লাউডফ্লেয়ার পেজেস / ওয়ার্কার্সে ভেরিয়েবল সেট করা

1. [Cloudflare Dashboard](https://dash.cloudflare.com)-এ যান।
2. **Workers & Pages** $\rightarrow$ **devhoist** প্রজেক্টে ক্লিক করুন।
3. **Settings** $\rightarrow$ **Variables and Secrets**-এ যান।
4. নিচের ভেরিয়েবলগুলো যোগ করুন:

| Variable Name | Description | Type |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | Plain text |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key | Plain text / Secret |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | Encrypted Secret |
| `WHM_HOST` | WHM Hostname / IP | Plain text |
| `WHM_USERNAME` | WHM Reseller Username | Plain text |
| `WHM_API_TOKEN` | WHM API Secret Token | Encrypted Secret |
| `UDDOKTAPAY_API_KEY` | UddoktaPay Gateway Key | Encrypted Secret |
| `STRIPE_SECRET_KEY` | Stripe Secret (Optional) | Encrypted Secret |

5. সেভ করে **"Retry deployment"** দিন — সাথে সাথে পুরো প্ল্যাটফর্ম আসল ডাটাবেস ও লাইভ ক্লাউড সার্ভারের সাথে সক্রিয় হয়ে যাবে!
