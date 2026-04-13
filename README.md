# MedPrice AI
MedPrice AI is a full-stack web application that helps users compare medicine prices across multiple pharmacy platforms with AI-powered insights.

Key Features
✅ Medicine Price Comparison
#Search and compare drug prices across different pharmacies
#Real-time price scraping from multiple pharmacy platforms
#Detailed price analysis and comparison tables

✅ AI-Powered Chatbot
#Google Generative AI (Gemini) integration
#Medicine recommendations and information
#Drug interaction checking
#Intelligent price suggestions

✅ User Authentication
#Google Sign-In via Supabase
#Secure user sessions
#User data persistence

✅ Prescription Management
#Upload and store prescriptions
#Prescription analysis with AI
#Track medication history


Tech Stack
*Frontend:
React + Vite
TailwindCSS (styling)
Supabase (authentication)
React Router (navigation)

Backend:
FastAPI (Python web framework)
Supabase (database & auth)
Google Generative AI API (Gemini)
BeautifulSoup4 (web scraping)
Playwright (browser automation)
SQLAlchemy (ORM)

Project Structure
How It Works
User Signs In → Google authentication via Supabase
Search Medicines → Backend scrapes pharmacy prices
View Comparisons → Shows prices from multiple pharmacies
AI Chatbot → Get recommendations and information
Manage Prescriptions → Upload and track prescriptions
Set Reminders → Get notifications for medications

Demo Endpoints
🏠 Frontend: http://localhost:5173
🔌 Backend API: http://localhost:8000
📚 API Docs: http://localhost:8000/docs
💚 Health Check: http://localhost:8000/health

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
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Frontend:

```powershell
cd frontend
npm run dev -- --host 0.0.0.0
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

