import { seedEvents } from '../src/data/seedEvents.js';
import { searchTinyFish, fetchUrls, extractEventsWithAgent } from './lib/tinyfish.js';

export const config = {
  maxDuration: 30,
};

const MAX_FETCH_URLS = 6;
const MAX_AGENT_RUNS = 1;
const AGENT_TIMEOUT_MS = 5000;
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

function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
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
    type + ' ' + field + ' ' + city + ' India 2025',
    field + ' ' + type + ' ' + city + ' India',
    'upcoming ' + type + ' ' + field + ' ' + city + ' India',
    type + ' ' + city + ' India students devfolio unstop',
  ];
}

function inferType(text) {
  const lower = (text || '').toLowerCase();
  if (lower.includes('hackathon')) return 'Hackathon';
  if (lower.includes('workshop')) return 'Workshop';
  if (lower.includes('meetup')) return 'Meetup';
  if (lower.includes('conference')) return 'Conference';
  if (lower.includes('bootcamp')) return 'Bootcamp';
  return 'Event';
}

function inferField(text) {
  const lower = (text || '').toLowerCase();
  if (lower.includes('design')) return 'Design';
  if (lower.includes('business') || lower.includes('startup')) return 'Business';
  if (lower.includes('data science') || lower.includes('data')) return 'Data Science';
  if (lower.includes('product')) return 'Product';
  return 'Technology';
}

function inferMode(text, url) {
  const combined = ((text || '') + ' ' + (url || '')).toLowerCase();
  if (combined.includes('online') || combined.includes('virtual') || combined.includes('remote')) {
    return 'Online';
  }
  if (combined.includes('hybrid')) return 'Hybrid';
  return 'In-person';
}

function inferCity(text) {
  const cities = ['Bengaluru', 'Delhi', 'Mumbai', 'Pune', 'Hyderabad', 'Chennai'];
  const lower = (text || '').toLowerCase();
  for (const c of cities) {
    if (lower.includes(c.toLowerCase())) return c;
  }
  return '';
}

function extractDate(text) {
  if (!text) return '';

  let m = text.match(/(202[5-9])-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])/);
  if (m) return m[0];

  m = text.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(202[5-9])/i);
  if (m) {
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mon = monthNames.findIndex((x) => x.toLowerCase() === m[2].toLowerCase().slice(0,3));
    return m[3] + '-' + String(mon + 1).padStart(2, '0') + '-' + m[1].padStart(2, '0');
  }

  m = text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(202[5-9])/i);
  if (m) {
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mon = monthNames.findIndex((x) => x.toLowerCase() === m[1].toLowerCase().slice(0,3));
    return m[3] + '-' + String(mon + 1).padStart(2, '0') + '-' + m[2].padStart(2, '0');
  }

  return '';
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

  if (/devfolio\.co|unstop\.com|eventbrite\.com|townscript\.com|skillenza\.com/.test(url)) {
    score += 20;
  }

  if (/\/(events?|hackathons?|workshops?|competitions?)\//.test(url)) score += 8;
  if (/register|registration|apply|rsvp/.test(text)) score += 6;
  if (/hackathon|workshop|meetup|conference|bootcamp|summit/.test(text)) score += 4;

  if (/blog|news|medium\.com|wikipedia/.test(url)) score -= 15;
  if (/\/d\//.test(url) || /\/discover\/?$/.test(url) || /\/hackathons\/?$/.test(url) || /\/events\/?$/.test(url)) score -= 18;
  if (/\/[^/]+\/?$/.test(url) && !/\.html?$/i.test(url)) score -= 12;
  if (/\/[0-9]+\//.test(url) || /[-_][0-9]{3,}/.test(url)) score += 6;

  return score;
}

async function discoverUrls(filters) {
  const queries = buildSearchQueries(filters);

  const searchPromises = queries.map((q) =>
    searchTinyFish({
      query: q,
      purpose: 'Find specific upcoming student events in India',
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

function mapSearchResultToEvent(result, fetchResult, filters) {
  const text = (
    (result.title || '') +
    ' ' +
    (result.snippet || '') +
    ' ' +
    (fetchResult?.text || '')
  );
  const url = result.url;
  const inferredDate = extractDate(text) || addDaysISO(30);

  return {
    id: 'tf-' + hashCode(url),
    title: result.title || fetchResult?.title || 'Untitled event',
    field: filters.field || inferField(text),
    type: filters.type || inferType(text),
    city: filters.city || inferCity(text) || 'India',
    startDate: inferredDate,
    endDate: inferredDate,
    venue: result.site_name || 'TBA',
    description:
      fetchResult?.description ||
      result.snippet ||
      'Student event. Visit the page for full details and registration.',
    registrationUrl: url,
    organizer: result.site_name || 'Unknown organizer',
    mode: inferMode(text, url),
    _source: 'tinyfish',
  };
}

async function enrichWithAgent(url, filters) {
  return extractEventsWithAgent(url, filters, AGENT_TIMEOUT_MS).catch((err) => {
    console.error('Agent enrichment error for', url, ':', err.message);
    return [];
  });
}

function dedupeEvents(events) {
  const seen = new Set();
  return events.filter((e) => {
    const key = (e.title + '|' + e.startDate + '|' + e.city).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(label + ' timed out after ' + ms + 'ms')),
        ms
      )
    ),
  ]);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

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
    const ranked = await withTimeout(discoverUrls(filters), 6000, 'URL discovery');
    const topUrls = ranked.map((r) => r.url).slice(0, MAX_FETCH_URLS);

    const fetchResults = topUrls.length
      ? await withTimeout(fetchUrls(topUrls), 5000, 'URL fetch')
      : [];

    const fetchByUrl = new Map();
    for (const fr of fetchResults) {
      if (fr.url || fr.final_url) {
        fetchByUrl.set(fr.url || fr.final_url, fr);
      }
    }

    let events = dedupeEvents(
      ranked
        .slice(0, MAX_FETCH_URLS)
        .map((r) => mapSearchResultToEvent(r, fetchByUrl.get(r.url), filters))
    );

    if (ranked.length && MAX_AGENT_RUNS > 0) {
      const enriched = await withTimeout(
        enrichWithAgent(ranked[0].url, filters),
        AGENT_TIMEOUT_MS,
        'Agent enrichment'
      );
      if (enriched.length) {
        const normalized = enriched.map((e) => ({
          id: 'tf-' + hashCode(e.registrationUrl || e._sourceUrl || e.title),
          title: e.title,
          field: e.field || filters.field || inferField(e.title + e.description),
          type: e.type || filters.type || inferType(e.title + e.description),
          city: e.city || filters.city || 'India',
          startDate: e.startDate,
          endDate: e.endDate || e.startDate,
          venue: e.venue || 'TBA',
          description: e.description || 'Student event.',
          registrationUrl: e.registrationUrl || e._sourceUrl || ranked[0].url,
          organizer: e.organizer || ranked[0].site_name || 'Unknown organizer',
          mode: e.mode || 'In-person',
          _source: 'tinyfish',
        }));
        events = dedupeEvents([...normalized, ...events]);
      }
    }

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
        fetched: topUrls.length,
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
