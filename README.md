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

The current UI uses local demo data so the interaction model can be validated before authentication and API wiring. The backend already exposes the V2 planner aggregate, task, and time-block endpoints.

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

## Product boundary

Web is the primary planning surface. Mobile remains a companion for reminders, schedule review, and quick capture. AI and automation are intentionally outside this milestone.
