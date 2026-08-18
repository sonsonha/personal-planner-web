# Personal OS Web

Calendar-first planning workspace for the Personal Secretary V2 rebuild.

## Current milestone

- interactive weekly calendar with day/week modes
- task pool with inbox and today views
- drag tasks onto the calendar to create time blocks
- drag scheduled blocks to reschedule them
- quick add with `Cmd/Ctrl + K`
- separate visual treatment for Google Calendar events
- responsive layout for narrower screens

The web now loads and mutates real V2 planner data through a same-origin server proxy. If the backend connection is not configured, it clearly falls back to demo data so the interaction model remains testable.

## Run locally

Requires Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

Validation:

```bash
npm run lint
npm test
npm run build
```

## Connect the backend

Copy `.env.example` to `.env.local`, then set `PLANNER_API_BASE_URL`.

**Local web + Railway backend (recommended):** point at your deployed API and use the same `PLANNER_WEB_TOKEN` as Railway (minimum 32 characters). Restart `npm run dev` after changing `.env.local`.

```env
PLANNER_API_BASE_URL=https://soc-server-production.up.railway.app
PLANNER_WEB_TOKEN=<matches Railway PLANNER_WEB_TOKEN>
```

Production ChatGPT Sites use `PLANNER_WEB_PRIVATE_KEY` (Ed25519) instead of the bearer token. Local dev can keep the shared token fallback.

Credentials are read only by the web server proxy and are never shipped to browser JavaScript. Production pages and proxy calls also use the private Site's authenticated-user headers.

## Product boundary

Web is the primary planning surface. Mobile remains a companion for reminders, schedule review, and quick capture. AI and automation are intentionally outside this milestone.
