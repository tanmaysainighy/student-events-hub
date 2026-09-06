import { seedEvents } from '../src/data/seedEvents.js';
import {
  searchTinyFish,
  extractEventsWithAgent,
} from './lib/tinyfish.js';

export const config = {
  maxDuration: 30,
};

const MAX_AGENT_RUNS = 3;
const AGENT_TIMEOUT_MS = 8000;
const OVERALL_TIMEOUT_MS = 26000;
const CACHE_TTL_MS = 5 * 60 * 1000;

const cache = new Map();

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function filterSeedEvents(filters) {
  return seedEvents.filter((event) => {
    if (filters.city && event.city !== filters.city) return false;
    if (filters.field && event.field !== filters.field) return false;
    if (filters.type && event.type !== filters.type) return false;
    if (filters.dateFrom && event.startDate < filters.dateFrom) return false;
    return true;
  });
}

function buildSearchQueries(filters) {
  const type = filters.type || 'events';
  const field = filters.field || 'student';
  const city = filters.city || 'India';

  return [
    type + ' ' + field + ' ' + city + ' India 2025 registration',
    field + ' ' + type + ' ' + city + ' site:devfolio.co OR site:unstop.com',
    'upcoming ' + field + ' ' + type + ' ' + city + ' India',
    field + ' ' + type + ' ' + city + ' India students',
  ];
}

function scoreUrl(result, filters) {
  let score = 0;
  const text = (
    (result.title || '') +
    ' ' +
    (result.snippet || '') +
    ' ' +
    (result.text || '')
  ).toLowerCase();
  const url = (result.url || '').toLowerCase();

  if (filters.city && text.includes(filters.city.toLowerCase())) score += 12;
  if (filters.field && text.includes(filters.field.toLowerCase())) score += 10;
  if (filters.type && text.includes(filters.type.toLowerCase())) score += 10;

  // Prefer known event platforms
  if (/devfolio\.co|unstop\.com|eventbrite\.com|townscript\.com|skillenza\.com/.test(url)) {
    score += 20;
  }

  // Boost pages that smell like event detail pages
  if (/\/(events?|hackathons?|workshops?|competitions?)\//.test(url)) score += 8;
  if (/register|registration|apply|rsvp/.test(text)) score += 6;
  if (/hackathon|workshop|meetup|conference|bootcamp|summit/.test(text)) score += 4;

  // Penalize generic / blog / listicle pages
  if (/blog|news|medium\.com|wikipedia/.test(url)) score -= 15;

  return score;
}

async function discoverUrls(filters) {
  const queries = buildSearchQueries(filters);
  const afterDate = todayISO();
  const purpose = 'Find specific upcoming student ' + (filters.type || 'events') + ' pages';

  const searchPromises = queries.map((q) =>
    searchTinyFish({
      query: q,
      purpose,
      afterDate,
      fetchConfig: { format: 'markdown' },
    }).catch((err) => {
      console.error('Search error for query "' + q + '":', err.message);
      return [];
    })
  );

  const resultsArrays = await Promise.all(searchPromises);
  const allResults = resultsArrays.flat();

  const seen = new Set();
  const unique = [];
  for (const r of allResults) {
    if (!r.url || seen.has(r.url)) continue;
    seen.add(r.url);
    unique.push(r);
  }

  return unique
    .map((r) => ({ ...r, score: scoreUrl(r, filters) }))
    .sort((a, b) => b.score - a.score);
}

async function extractFromUrls(urls, filters) {
  const limited = urls.slice(0, MAX_AGENT_RUNS);
  if (!limited.length) return [];

  const promises = limited.map((url) =>
    extractEventsWithAgent(url, filters, AGENT_TIMEOUT_MS).catch((err) => {
      console.error('Agent error for', url, ':', err.message);
      return [];
    })
  );

  const results = await Promise.all(promises);
  return results.flat();
}

function normalizeEvent(event, filters) {
  const url = event.registrationUrl || event._sourceUrl || '';
  return {
    id: 'tf-' + hashCode(url || event.title + event.startDate),
    title: event.title,
    field: event.field || filters.field || 'Technology',
    type: event.type || filters.type || 'Event',
    city: event.city || filters.city || 'India',
    startDate: event.startDate,
    endDate: event.endDate || event.startDate,
    venue: event.venue || 'TBA',
    description:
      event.description || 'Details available on the registration page.',
    registrationUrl: url,
    organizer: event.organizer || 'Unknown organizer',
    mode: event.mode || 'In-person',
    _source: 'tinyfish',
  };
}

function dedupeEvents(events) {
  const seen = new Set();
  return events.filter((e) => {
    const key = (e.title + '|' + e.startDate).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(label + ' timed out after ' + ms + 'ms')), ms)
    ),
  ]);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const filters = {
    city: req.query.city || '',
    field: req.query.field || '',
    type: req.query.type || '',
    dateFrom: req.query.dateFrom || '',
    search: req.query.search || '',
  };

  const cacheKey = JSON.stringify(filters);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return res.status(200).json(cached.data);
  }

  try {
    const ranked = await withTimeout(
      discoverUrls(filters),
      12000,
      'URL discovery'
    );

    const agentUrls = ranked.map((r) => r.url).slice(0, MAX_AGENT_RUNS);

    const extracted = agentUrls.length
      ? await withTimeout(
          extractFromUrls(agentUrls, filters),
          OVERALL_TIMEOUT_MS,
          'Event extraction'
        )
      : [];

    let events = dedupeEvents(extracted.map((e) => normalizeEvent(e, filters)));

    // Supplement with seed data if live results are sparse
    if (events.length < 4) {
      const seed = filterSeedEvents(filters);
      events = dedupeEvents([...events, ...seed]);
    }

    const response = {
      source: events.some((e) => e._source === 'tinyfish') ? 'tinyfish' : 'seed',
      events,
      query: filters,
      meta: {
        searched: ranked.length,
        scraped: agentUrls.length,
      },
    };

    cache.set(cacheKey, { ts: Date.now(), data: response });
    res.status(200).json(response);
  } catch (err) {
    console.error('Pipeline error:', err.message);
    const fallback = {
      source: 'seed',
      events: filterSeedEvents(filters),
      query: filters,
      notice:
        'Live extraction unavailable or timed out. Showing sample events. Add TINYFISH_API_KEY or check logs.',
      error: err.message,
    };
    res.status(200).json(fallback);
  }
}
