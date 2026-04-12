# MedPrice AI

MedPrice AI is a local full-stack app for comparing medicine prices across multiple pharmacy platforms, with Google sign-in powered by Supabase.

## Run Locally

From the project root:

```powershell
.\run_app.ps1
```

This starts:

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:8000`
- API docs: `http://127.0.0.1:8000/docs`

## Manual Start

Backend:

```powershell
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
cd frontend
npm run dev -- --host 127.0.0.1
```

## Environment

Backend env file:

- [backend/.env](c:/Users/venka/OneDrive/Desktop/medprice/backend/.env)

Frontend env file:

- [frontend/.env](c:/Users/venka/OneDrive/Desktop/medprice/frontend/.env)

## Google Sign-In Setup

Supabase:

- Enable `Google` in `Authentication > Providers > Google`
- Set `Site URL` to `http://127.0.0.1:5173`
- Add redirect URL `http://127.0.0.1:5173`

Google Cloud OAuth client:

- Application type: `Web application`
- Authorized JavaScript origin: `http://127.0.0.1:5173`
- Authorized redirect URI:
  `https://dpzxkgsaspotrgikrgic.supabase.co/auth/v1/callback`

## Notes

- If medicine search fails, check that the backend is running on port `8000`.
- If Google sign-in fails, re-check Supabase provider settings and the Google OAuth redirect URI.
