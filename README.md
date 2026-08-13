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

Copy `.env.example` to `.env.local`, then set `PLANNER_API_BASE_URL` and `PLANNER_WEB_TOKEN`. The same token must be configured as `PLANNER_WEB_TOKEN` on the backend and must contain at least 32 characters.

The token is read only by the web server proxy. It is never shipped to browser JavaScript. Production pages and proxy calls also use the private Site's authenticated-user headers.

## Product boundary

Web is the primary planning surface. Mobile remains a companion for reminders, schedule review, and quick capture. AI and automation are intentionally outside this milestone.
