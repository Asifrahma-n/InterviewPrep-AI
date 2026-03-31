# InterviewPrep AI

An AI-powered interview preparation platform. Practice job interviews with a voice AI interviewer and get structured feedback.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables (see [Environment](#environment) below).

3. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You’ll be redirected to sign-in if not authenticated.

---

## How the Project Works

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 15 (Turbopack), React 19 |
| **Auth & DB** | Firebase (Auth + Firestore), server-side session cookies |
| **Voice** | VAPI (11labs voice, Deepgram transcription, OpenAI GPT-4 for the interviewer) |
| **AI / LLM** | Vercel AI SDK + Google Gemini (`gemini-2.0-flash-001`) for question generation and feedback |
| **UI** | Tailwind v4, shadcn/ui (new-york), Radix, Lucide, Sonner toasts |
| **Forms** | React Hook Form + Zod |

### Project Structure

- **`app/`** — App Router routes and layouts  
  - `(auth)/` — Sign-in / sign-up (unauthenticated only)  
  - `(root)/` — Main app (auth required): home, interview setup, interview session, feedback  
- **`components/`** — UI (AuthForm, InterviewSetup, Agent, InterviewCard, DisplayTechIcons, shadcn components)  
- **`lib/actions/`** — Server actions: `auth.action`, `general.action`, `interview.action`  
- **`firebase/`** — `admin.ts` (server), `client.ts` (browser)  
- **`constants/`** — Roles, levels, types, tech mappings, VAPI assistant config, feedback schema  
- **`types/`** — Global TypeScript interfaces  

### Authentication Flow

1. **Sign-up** (`/sign-up`): Firebase `createUserWithEmailAndPassword` → server action `signUp()` writes user into Firestore `users` and redirects to sign-in.  
2. **Sign-in** (`/sign-in`): Firebase `signInWithEmailAndPassword` → user’s `idToken` sent to server → `signIn()` creates a **session cookie** via Firebase Admin `createSessionCookie()`.  
3. **Protected routes**: Root layout calls `isAuthenticated()` (reads session cookie, verifies with Firebase Admin). If not authenticated → redirect to `/sign-in`.  
4. **Sign-out**: Server action deletes the session cookie and redirects to `/sign-in`.

Session is stored in an **httpOnly** cookie; user identity on the server comes from Firebase Admin + Firestore `users`.

### Main User Flows

#### 1. Home (`/`)

- **Your Interviews**: List of interviews for the current user (`getInterviewsByUserId`).  
- **Take an Interview**: List of “latest” interviews from others (`getLatestInterviews`: `finalized === true`, `userId !== currentUser`).  
- Each item is an `InterviewCard` (role, type, date, tech stack, link to do interview or see feedback).  
- CTA: “Start an Interview” → `/interview`.

#### 2. Interview Setup (`/interview`)

- **InterviewSetup** is a multi-step form (with optional text-to-speech for the current question):  
  1. **Role** (e.g. Frontend Developer) or “Other” + custom role  
  2. **Experience level** (Junior → Architect)  
  3. **Interview type** (Technical, Behavioral, Mixed, System Design)  
  4. **Question count** (5, 10, 15, 20)  
  5. **Tech stack** (from `constants` mappings + custom tech)  
- On submit it calls **`createInterview`** (server action) with `userId`, role, level, type, techStack, questionCount.  
- Questions are generated on the server via Gemini (no VAPI for setup).  
- On success → redirect to `/interview/[id]`.

#### 3. Interview Creation (Server-Side)

- **`lib/actions/interview.action.ts`** `createInterview`:  
  - Builds a text prompt from role, level, type, tech stack, and question count.  
  - Calls **Gemini** (`generateObject` with a `questions: string[]` schema; fallback `generateText` + safe JSON parsing).  
  - Writes one document to Firestore `interviews`: `userId`, `role`, `level`, `type`, `techstack`, `questions`, `createdAt`, `finalized: false`.  
  - Returns `{ success, interviewId }`.  

#### 4. Live Interview (`/interview/[id]`)

- Loads **interview by id** and **current user**.  
- Renders **Agent** with: `userName`, `userId`, `interviewId`, `type="interview"`, `questions` from the document.  
- **Agent** (VAPI):  
  - Uses **VAPI Web SDK** (`lib/vapi.sdk.ts`) with `NEXT_PUBLIC_VAPI_WEB_TOKEN`.  
  - For `type === "interview"`: starts a call with the **interviewer** assistant from `constants` (OpenAI GPT-4, 11labs “sarah”, Deepgram nova-2). The system prompt includes `{{questions}}`; the component passes the interview’s questions as `variableValues.questions`.  
  - Subscribes to VAPI events: `call-start`, `call-end`, `message` (final transcripts), `speech-start`/`speech-end`, `error`.  
  - Accumulates **transcript** as `messages` (role + content).  
  - “Call” starts the call; “End” stops it.  
- When the call ends and there are messages, the app calls **`createFeedback`** with `interviewId`, `userId`, and `transcript`, then redirects to `/interview/[id]/feedback`.

#### 5. Feedback Generation and Page

- **`createFeedback`** (in `general.action.ts`):  
  - Formats the transcript and calls **Gemini** with a structured prompt and **`feedbackSchema`** (Zod): totalScore, categoryScores (Communication, Technical, Problem Solving, Cultural Fit, Confidence), strengths, areasForImprovement, finalAssessment.  
  - Saves the result into Firestore `feedback` (linked to `interviewId`, `userId`) and returns `feedbackId`.  
- **Feedback page** (`/interview/[id]/feedback`) is a placeholder; you can extend it to load and display the feedback document.

### Data Model (Firestore)

- **`users`**: `name`, `email` (doc id = Firebase Auth uid).  
- **`interviews`**: `userId`, `role`, `level`, `type`, `techstack[]`, `questions[]`, `createdAt`, `finalized`.  
- **`feedback`**: `interviewId`, `userId`, `totalScore`, `categoryScores`, `strengths`, `areasForImprovement`, `finalAssessment`, `createdAt`.

### Key Files

| Purpose | File(s) |
|--------|--------|
| Auth (cookie, user, sign in/up/out) | `lib/actions/auth.action.ts` |
| Session + layout guard | `app/(root)/layout.tsx` |
| List interviews / create feedback | `lib/actions/general.action.ts` |
| Create interview (Gemini → Firestore) | `lib/actions/interview.action.ts` |
| Firebase server/client | `firebase/admin.ts`, `firebase/client.ts` |
| VAPI client & interviewer config | `lib/vapi.sdk.ts`, `constants/index.ts` |
| Voice call UI + transcript | `components/Agent.tsx` |
| Setup flow | `components/InterviewSetup.tsx` |
| Auth UI | `components/AuthForm.tsx` |

### Environment

Create a `.env.local` (and optionally `.env`) with:

- **Firebase (server)**: `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` (for Admin SDK).  
- **VAPI**: `NEXT_PUBLIC_VAPI_WEB_TOKEN`. Optional: `NEXT_PUBLIC_VAPI_WORKFLOW_ID` for legacy voice-based setup.  
- **Gemini**: `GOOGLE_GENERATIVE_AI_API_KEY`.

Firebase client config is in `firebase/client.ts` (you can move keys to env if needed).

---

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase](https://firebase.google.com/docs)
- [VAPI](https://vapi.ai/)
- [Vercel AI SDK](https://sdk.vercel.ai/)

## Deploy on Vercel

See [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying). Configure the same environment variables in your Vercel project.
