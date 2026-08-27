# Team Carpool Board prototype

Static, local-first mockup for the team carpool scheduler described in the Obsidian note `carpool-scheduler-requirements.md`. The simplified date-by-route layout is based on the structure of the prior-season Google Sheet.

## Run locally

From the repository root:

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173/carpool/`.

## Prototype behavior

- Shows a static snapshot of the 28 future Lara/Blue Pumas events found on August 27, 2026 in the connected `LMFC Soccer - Schmidt - 2024-2025 Season` Google Calendar.
- Includes both practices and games whose titles match `Blue Puma` case-insensitively; the filter intentionally matches the plural `Blue Pumas`.
- Displays each source event's title, time, and location with two volunteer slots: `To event` and `Home`.
- Treats the page as a rolling schedule in the `America/New_York` timezone: past dates are hidden, today remains visible all day, and returning visitors jump directly to the current schedule once earlier events exist.
- Lets a parent claim an open trip with their name.
- Lets signups created in the current browser be edited or canceled.
- Persists prototype signups in browser `localStorage`.
- Adds an expandable pickup-address directory between the introduction and schedule so a parent can save a child or family name and pickup address once, then use it as a standing reference.
- Lets address entries created in the current browser be edited or removed and makes clear that the private team link protects sensitive home-address information.
- Produces a downloadable `.ics` preview containing the full current schedule.
- Demonstrates the planned Google Calendar subscription flow with a placeholder production feed URL.
- Titles ICS events `BP Practice - Driver Needed` until both rides are covered, then list the assigned driver or drivers; games use the equivalent `BP Game` title.

This is a front-end prototype only. The source events are a checked-in snapshot, and signups and pickup addresses are local to one browser. Automated calendar ingestion, shared real-time signups and addresses, and a hosted calendar feed require a backend in the implementation phase.
