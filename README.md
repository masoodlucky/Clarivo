# Clarivo

AI-powered VAPT report analysis platform. Firms upload penetration-test reports; Clarivo extracts every finding, scores risk, tracks remediation, and gives clients their own dashboard.

## Stack
React 19 + Vite, Tailwind, Firebase Auth/Firestore, Supabase Storage (report files, via the `report-files` Edge Function), Gemini 2.5 Flash or a local Ollama model for analysis.

## Run locally
1. `npm install`
2. Create `.env` (never commit it) with the `VITE_FIREBASE_*`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GEMINI_API_KEY` values.
   Set `VITE_LLM_PROVIDER=gemini` (cloud) or `ollama` (on-prem, with `VITE_OLLAMA_MODEL`).
3. `npm run dev`

Publish `firestore.rules` in the Firebase console, and deploy `supabase/functions/report-files` + run `supabase/setup.sql` in Supabase.
