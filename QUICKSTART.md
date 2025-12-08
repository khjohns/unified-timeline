# Quickstart Guide - Event Sourcing Prototype

This guide will get you up and running with the Event Sourcing prototype in under 5 minutes.

## 🎯 What's Been Fixed

### ✅ Backend (`backend/app.py`)
- **Removed**: Legacy routes (case_routes, varsel_routes, koe_routes, svar_routes)
- **Added**: Event Sourcing routes (event_routes, webhook_routes, utility_routes)
- **Improved**: Clear startup banner showing all available endpoints
- **Changed**: Catenda integration is now optional (runs without credentials)

### ✅ API Endpoints (Now Consistent)
All endpoints now use English with plural form `/api/cases/`:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/events` | POST | Submit single event |
| `/api/events/batch` | POST | Submit multiple events atomically |
| `/api/cases/<id>/state` | GET | Get computed case state |
| `/api/cases/<id>/timeline` | GET | Get event timeline |
| `/api/health` | GET | Health check |
| `/api/csrf` | GET | Get CSRF token |
| `/api/magic-link` | GET | Generate magic link |

### ✅ Frontend (`src/api/state.ts`)
- Updated to use `/api/cases/` endpoint (was `/api/saker/`)

---

## 🚀 Option 1: Mock Mode (Fastest - No Backend)

Perfect for testing the UI without setting up the backend.

```bash
# 1. Install dependencies
npm install

# 2. Enable mock mode
echo "VITE_USE_MOCK_API=true" > .env.local

# 3. Start frontend
npm run dev

# 4. Open browser
# http://localhost:3000
```

**What you'll see:**
- Example cases page with 4 pre-loaded scenarios
- Click a case to see the timeline, status dashboard, and actions
- All interactions work with mock data (no backend needed)

---

## 🚀 Option 2: Full Stack (Backend + Frontend)

### Prerequisites
- Python 3.11+ with pip
- Node.js 18+ with npm

### Step 1: Set Up Backend

```bash
# Navigate to backend
cd backend

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env

# Generate secrets (run these commands)
python3 -c "import secrets; print('CSRF_SECRET=' + secrets.token_urlsafe(32))" >> .env
python3 -c "import secrets; print('FLASK_SECRET_KEY=' + secrets.token_hex(32))" >> .env

# Set CORS for frontend
echo "ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173" >> .env

# Start backend server
python app.py
```

**Expected output:**
```
======================================================================
🚀 KOE Backend API - Event Sourcing Architecture
======================================================================

📡 Server: http://localhost:8080
🔍 Environment: Development
🔗 CORS: http://localhost:5173

📋 Available Endpoints:
  ┌─ Event Submission
  ├── POST   /api/events              Submit single event
  └── POST   /api/events/batch        Submit multiple events atomically

  ┌─ State & Timeline
  ├── GET    /api/cases/<id>/state    Get computed case state
  └── GET    /api/cases/<id>/timeline Get event timeline
  ...
======================================================================
```

### Step 2: Set Up Frontend

Open a **new terminal** (keep backend running):

```bash
# Install dependencies
npm install

# Configure to use real backend
echo "VITE_API_BASE_URL=http://localhost:8080" > .env.local
echo "VITE_USE_MOCK_API=false" >> .env.local

# Start frontend
npm run dev
```

### Step 3: Test End-to-End

1. Open http://localhost:5173
2. Click on a case (e.g., "SAK-001")
3. Open browser console (F12) to see API calls
4. Try submitting an event (e.g., "Send Grunnlag")
5. Check backend terminal for event logs

---

## 🧪 Testing Checklist

### Frontend Only (Mock Mode)
- [ ] Homepage loads with example cases
- [ ] Can navigate to case detail page
- [ ] Status dashboard shows three tracks (Grunnlag, Vederlag, Frist)
- [ ] Can open action modals
- [ ] Can fill out forms (mock submission)
- [ ] Console logs show mock events

### Full Stack
- [ ] Backend starts without errors
- [ ] Frontend connects to backend (check Network tab)
- [ ] GET `/api/cases/<id>/state` returns state
- [ ] Can submit event via POST `/api/events`
- [ ] Event is persisted (check `backend/data/events_*.json`)
- [ ] State updates after submission
- [ ] Timeline shows new event

---

## 🔧 Troubleshooting

### Backend won't start
**Error:** `CATENDA_CLIENT_ID missing`
**Solution:** This is just a warning now. The backend will start anyway.

**Error:** `Module not found`
**Solution:**
```bash
cd backend
pip install -r requirements.txt
```

### Frontend can't connect to backend
**Error:** `Network error: Could not connect to server`
**Solution:**
1. Check backend is running on port 8080
2. Check `.env.local` has correct URL:
   ```
   VITE_API_BASE_URL=http://localhost:8080
   ```
3. Check CORS settings in `backend/.env`:
   ```
   ALLOWED_ORIGINS=http://localhost:5173
   ```

### Port 8080 already in use
**Solution:** Change backend port:
```python
# In backend/app.py, last line:
app.run(host='0.0.0.0', port=8081, debug=True)
```

Then update frontend:
```bash
echo "VITE_API_BASE_URL=http://localhost:8081" > .env.local
```

---

## 📁 Where Data is Stored

### Events (Event Store)
```
backend/koe_data/events/<sak_id>.json
```

Each case has its own event log file with:
- All events in chronological order
- Version number for optimistic locking
- Immutable append-only structure

### Example Event File
```json
{
  "events": [
    {
      "event_id": "evt-001",
      "event_type": "sak_opprettet",
      "sak_id": "SAK-001",
      "tidsstempel": "2025-12-04T12:00:00Z",
      "aktor": "Ole Olsen",
      "aktor_rolle": "TE",
      "sakstittel": "Test Case"
    },
    {
      "event_id": "evt-002",
      "event_type": "grunnlag_opprettet",
      "sak_id": "SAK-001",
      "tidsstempel": "2025-12-04T12:05:00Z",
      "data": {
        "hovedkategori": "forsinkelse_bh",
        "underkategori": "prosjektering",
        ...
      }
    }
  ],
  "version": 2
}
```

---

## 🎓 Next Steps

### Learn the Architecture
- Read `docs/IMPLEMENTATION_PROMPT.md` - Full migration plan
- Read `docs/BACKEND_NEXT_STEPS.md` - Implementation checklist
- Check `backend/tests/test_models/test_events.py` - 32 passing tests

### Add Catenda Integration
1. Get Catenda Developer credentials
2. Add to `backend/.env`:
   ```
   CATENDA_CLIENT_ID=your_client_id
   CATENDA_CLIENT_SECRET=your_client_secret
   CATENDA_PROJECT_ID=your_project_id
   ```
3. Restart backend

### Deploy to Production
- Frontend: Vite build → Static hosting (Vercel, Netlify)
- Backend: Docker → Azure Container Apps
- Follow `docs/UNIFIED_TIMELINE_MIGRATION_PLAN_V4_1_1.md` Appendix E

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Timeline   │  │   Dashboard  │  │ Action Modals│         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                  │
│         └──────────────────┴──────────────────┘                 │
│                            │                                     │
│                   ┌────────▼─────────┐                          │
│                   │   API Client     │                          │
│                   │  (state.ts,      │                          │
│                   │   events.ts)     │                          │
│                   └────────┬─────────┘                          │
└────────────────────────────┼──────────────────────────────────┘
                             │ HTTP (REST API)
┌────────────────────────────▼──────────────────────────────────┐
│                     BACKEND (Flask)                            │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │             event_routes.py (Blueprint)                  │ │
│  │  POST /api/events     │  GET /api/cases/<id>/state       │ │
│  │  POST /api/events/batch  GET /api/cases/<id>/timeline    │ │
│  └──────┬───────────────────────────────┬───────────────────┘ │
│         │                                │                     │
│  ┌──────▼──────────┐           ┌────────▼─────────┐          │
│  │  API Validators │           │ Timeline Service │          │
│  │ (NS 8407 rules) │           │ (Event Replay)   │          │
│  └──────┬──────────┘           └────────┬─────────┘          │
│         │                                │                     │
│  ┌──────▼────────────────────────────────▼─────────┐         │
│  │          Event Repository                        │         │
│  │      (Optimistic Locking + Persistence)          │         │
│  └──────────────────────┬───────────────────────────┘         │
│                         │                                      │
│                ┌────────▼─────────┐                           │
│                │  JSON Event Log  │                           │
│                │ (Append-Only)    │                           │
│                └──────────────────┘                           │
└──────────────────────────────────────────────────────────────┘
```

**Key Principles:**
1. **Immutable Events** - Once written, never changed
2. **Optimistic Locking** - Prevents concurrent update conflicts
3. **State Computation** - Current state = replay all events
4. **Validation in Layers** - API validators → Business rules → Event store

---

## 💡 Tips

### Development Workflow
1. Start with **Mock Mode** to develop UI
2. Switch to **Full Stack** when integrating backend
3. Add **Catenda** last (requires credentials)

### Debugging
- Check browser console (F12) for frontend errors
- Check backend terminal for API logs
- Event files in `backend/data/` show what's persisted

### Testing Events
Use the mock scenarios in `backend/mocks/mock_events.py`:
- Scenario 1: Full approval workflow
- Scenario 2: Subsidiary approval (grunnlag rejected)
- Scenario 3: Partial approval (amount disagreement)
- Scenario 4: Precluded claim (late warning)

---

**Questions?** Check the documentation in `docs/` or open an issue.

**Ready to code?** Start with Mock Mode and work your way up! 🚀
