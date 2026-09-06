# StudentEvents

A Vite + React app for Indian students to discover workshops, hackathons, meetups, and conferences in their city.

**Live data source:** [TinyFish](https://tinyfish.ai) Search API (free tier). The app works immediately with sample data and switches to live search results once you add a TinyFish API key.

## Features

- Filter by city, field, event type, and start date
- Full-text search across titles, descriptions, venues, and organizers
- Event detail modal with date, venue, organizer, and registration link
- Save favorite events (stored in browser localStorage)
- Responsive, modern minimal UI
- Secure TinyFish API key storage on Vercel's backend

## Tech stack

- **Frontend:** Vite + React + CSS
- **Backend:** Vercel serverless function (`/api/events.js`)
- **Data:** TinyFish Search API + seeded fallback dataset
- **Hosting:** Vercel

## Getting started

```bash
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`.

> Note: `/api/events` is a Vercel serverless function. To test it locally, run `npx vercel dev` or deploy to Vercel.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo on [vercel.com](https://vercel.com).
3. Add the environment variable:
   - `TINYFISH_API_KEY` — get yours at [agent.tinyfish.ai](https://agent.tinyfish.ai)
4. Deploy.

If `TINYFISH_API_KEY` is not set, the app serves the sample dataset so it still looks complete.

## Project structure

```
student-events-hub/
├── api/
│   └── events.js              # Vercel serverless function
├── src/
│   ├── components/
│   │   ├── EventCard.jsx
│   │   ├── EventModal.jsx
│   │   ├── FavoriteButton.jsx
│   │   ├── FilterBar.jsx
│   │   └── Header.jsx
│   ├── data/
│   │   └── seedEvents.js      # 22 sample events across 6 cities
│   ├── hooks/
│   │   └── useLocalStorage.js
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── index.html
├── package.json
├── vercel.json
└── vite.config.js
```

## How the TinyFish integration works

- The frontend calls `/api/events?city=...&field=...&type=...&dateFrom=...`
- The backend builds a search query like `"Hackathon Technology in Bengaluru India students upcoming"`
- It calls TinyFish Search API (`api.search.tinyfish.ai`) using your secure API key
- Results are mapped to the app's event schema and returned as JSON
- If TinyFish is unavailable or the key is missing, the backend returns filtered sample events

## Customizing

- Edit `src/data/seedEvents.js` to change sample events, cities, fields, or event types.
- Update the search query builder in `api/events.js` to tune TinyFish results.
- Swap the Search API for TinyFish Agent API if you need deeper page extraction (paid, per-step).
