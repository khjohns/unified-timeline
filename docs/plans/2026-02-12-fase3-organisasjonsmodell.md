# Fase 3: Organisasjonsmodell - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Minimal MVP for project creation, settings, and management UI.

**Architecture:** Server-generated UUID for project IDs. Backend PATCH endpoints for update/deactivate. Frontend with dedicated API module, React Query hooks, create page, settings page. ProjectSelector refactored to React Query for automatic cache invalidation.

**Tech Stack:** Flask (backend endpoints), React 19 + TypeScript + Tanstack Query (frontend), Zod + react-hook-form (forms), Punkt design system

---

## Task 1: Backend - Server-generated UUID + Update/Deactivate endpoints

**Files:**
- Modify: `backend/models/project.py`
- Modify: `backend/repositories/project_repository.py`
- Modify: `backend/routes/project_routes.py`
- Create: `backend/tests/test_api/test_project_api.py`
- Create: `backend/tests/test_repositories/test_project_repository.py`

**Changes:**
- Add `CreateProjectRequest` and `UpdateProjectRequest` Pydantic models
- Add `update()` and `deactivate()` methods to `SupabaseProjectRepository`
- Change `POST /api/projects` to auto-generate `uuid4()` (no client-provided id)
- Add `PATCH /api/projects/<project_id>` (admin only, update name/description)
- Add `PATCH /api/projects/<project_id>/deactivate` (admin only)
- Tests first following `test_membership_api.py` pattern

---

## Task 2: Frontend - `src/api/projects.ts` + `src/types/project.ts`

**Files:**
- Create: `src/types/project.ts`
- Create: `src/api/projects.ts`

**Changes:**
- `Project` interface, `CreateProjectPayload`, `UpdateProjectPayload` types
- `listProjects()`, `getProject()`, `createProject()`, `updateProject()`, `deactivateProject()` API functions
- Follow `membership.ts` pattern

---

## Task 3: Frontend - `src/hooks/useProjects.ts` React Query hooks

**Files:**
- Create: `src/hooks/useProjects.ts`

**Changes:**
- Query keys factory: `projectQueryKeys`
- `useProjects()`, `useProjectDetail()`, `useCreateProject()`, `useUpdateProject()`, `useDeactivateProject()`
- Follow `useProjectMembers.ts` pattern

---

## Task 4: Frontend - Refactor ProjectSelector to React Query

**Files:**
- Modify: `src/components/ProjectSelector.tsx`

**Changes:**
- Replace raw `useState`/`useEffect` fetch with `useProjects()` hook
- Remove inline `apiFetch` and `ProjectListResponse` interface
- Keeps same UX but now supports automatic invalidation after project creation

---

## Task 5: Frontend - Create Project page (OpprettProsjektPage)

**Files:**
- Create: `src/pages/OpprettProsjektPage.tsx`

**Changes:**
- Route: `/prosjekter/nytt`
- Zod schema + react-hook-form (name required, description optional)
- Follow `OpprettSakPage` pattern: PageHeader + Card + SectionContainer + FormField
- On success: set active project, navigate to `/saker`

---

## Task 6: Frontend - Project Settings page (ProsjektInnstillingerPage)

**Files:**
- Create: `src/pages/ProsjektInnstillingerPage.tsx`

**Changes:**
- Route: `/innstillinger`
- Edit name/description with react-hook-form
- Link to `/medlemmer` for member management
- "Faresone" section with deactivate button + AlertDialog confirmation
- Uses `useProjectDetail()` + `useUpdateProject()` + `useDeactivateProject()`

---

## Task 7: Navigation - Routes and menu links

**Files:**
- Modify: `src/App.tsx` (add routes)
- Modify: `src/components/PageHeader.tsx` (add menu links)

**Changes:**
- Add lazy imports and protected routes for `/prosjekter/nytt` and `/innstillinger`
- Add "Prosjektinnstillinger" + "Nytt prosjekt" links in PageHeader dropdown

---

## Verification

1. `cd backend && make test` - All pass
2. `npm run test` - All pass
3. `npm run lint` - No errors
4. Manual: Create project -> ProjectSelector updates -> Settings page works -> Deactivate works
