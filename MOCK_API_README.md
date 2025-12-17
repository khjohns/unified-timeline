# Mock API and GitHub Pages Deployment

This frontend can run independently without a backend using mock data. This is useful for:
- Development without backend
- Testing and demonstrations
- GitHub Pages preview deployment

## 🚀 Quick Start with Mock Data

### Local Development

```bash
# The project is pre-configured to use mock API in development
npm run dev

# Visit http://localhost:3000/demo to see available mock cases
```

### Access Mock Cases

Navigate to `/demo` to see 3 pre-configured cases:

1. **SAK-2025-001**: Active case under processing
   - Grunnlag: ✓ Godkjent
   - Vederlag: ⏳ Under behandling
   - Frist: ◐ Delvis godkjent

2. **SAK-2025-002**: New draft case
   - All tracks ready for submission
   - Perfect for testing forms

3. **SAK-2024-089**: Fully approved case
   - Ready for EO issuance
   - Shows complete flow

## 🎭 Mock API Configuration

### Environment Variables

The mock mode is controlled by `VITE_USE_MOCK_API` environment variable:

**`.env.development`** (local dev):
```bash
VITE_USE_MOCK_API=true
```

**`.env.production`** (GitHub Pages):
```bash
VITE_USE_MOCK_API=true
```

### Switching Between Mock and Real API

Create `.env.local` to override:

```bash
# Use real backend
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=http://localhost:5000

# Or use mock data
VITE_USE_MOCK_API=true
```

## 📦 What's Mocked?

### API Endpoints

- **GET `/api/saker/{id}/state`**: Returns mock case state
- **POST `/api/saker/{id}/events`**: Simulates event submission (logs to console)

### Mock Data Features

- ✅ Realistic SakState data matching TypeScript types
- ✅ Complete timeline events for each case
- ✅ Network delay simulation (300-800ms)
- ✅ All track statuses (utkast, sendt, godkjent, etc.)
- ✅ Three different scenarios for testing

### Form Submissions

When mock mode is enabled:
- Forms validate normally
- Submission shows loading state
- Success message appears
- **Data is NOT persisted** (page refresh resets)
- Event details logged to console

## 🌐 GitHub Pages Deployment

### Automatic Deployment

The project is configured to automatically deploy to GitHub Pages when pushing to `main`:

1. Push to `main` branch
2. GitHub Actions builds with `VITE_USE_MOCK_API=true`
3. Deploys to `https://[username].github.io/unified-timeline/`

### Manual Deployment

```bash
# Build for production (with mock API)
npm run build

# Preview production build locally
npm run preview

# Check dist/fonts/ to verify fonts copied
ls dist/fonts/
```

### Workflow File

See `.github/workflows/deploy-gh-pages.yml` for deployment configuration.

## 🧪 Testing Mock API

### Verify Mock Mode is Active

1. Open browser console
2. Look for mock mode indicators
3. Submit a form - check console for "Mock event submitted:"

### Test All Forms

Navigate to a draft case (SAK-2025-002) and test:
- ✓ Send Grunnlag form
- ✓ Send Vederlag form
- ✓ Send Frist form

All submissions will show success but won't persist data.

## 📁 File Structure

```
src/
├── mocks/
│   └── mockData.ts          # Mock cases and timeline data
├── api/
│   ├── client.ts            # Mock mode detection
│   ├── state.ts             # State API with mock support
│   └── events.ts            # Events API with mock support
└── pages/
    ├── ExampleCasesPage.tsx # Case selector
    └── CasePage.tsx         # Case details (uses mock data)
```

## 🔧 Customizing Mock Data

Edit `src/mocks/mockData.ts` to add more cases:

```typescript
export const mockSakState4: SakState = {
  sak_id: 'SAK-2025-003',
  sakstittel: 'Your custom case',
  // ... rest of the state
};

// Add to mockCaseList
export const mockCaseList = [
  // ... existing cases
  {
    id: 'SAK-2025-003',
    title: 'Your custom case',
    status: 'Your status',
  },
];
```

## 🚫 Limitations

When using mock API:
- ❌ Data doesn't persist between page refreshes
- ❌ No real backend validation
- ❌ Timeline events are static (don't update after form submission)
- ❌ No authentication/authorization
- ✅ Perfect for frontend development and testing
- ✅ Great for demonstrations and screenshots

## 🔄 Switching to Real Backend

When backend is ready:

1. Update `.env.production`:
   ```bash
   VITE_USE_MOCK_API=false
   VITE_API_BASE_URL=https://your-api.com
   ```

2. Update GitHub Actions workflow to use real API URL

3. Rebuild and deploy

## 📚 Additional Resources

- Mock data: `src/mocks/mockData.ts`
- API client: `src/api/client.ts`
- Example cases page: `src/pages/ExampleCasesPage.tsx`
- GitHub Pages workflow: `.github/workflows/deploy-gh-pages.yml`
