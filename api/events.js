import { seedEvents, FIELDS, EVENT_TYPES } from '../src/data/seedEvents.js';

const TINYFISH_SEARCH_URL = 'https://api.search.tinyfish.ai/';

function normalizeField(value) {
  if (!value) return '';
  const lower = value.toLowerCase();
  return FIELDS.find((f) => lower.includes(f.toLowerCase())) || '';
}

function normalizeType(value) {
  if (!value) return '';
  const lower = value.toLowerCase();
  return EVENT_TYPES.find((t) => lower.includes(t.toLowerCase())) || '';
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).slice(0, 8);
}

function mapSearchResult(result, overrides) {
  const title = result.title || 'Untitled event';
  const url = result.url || '';
  const inferredField = normalizeField(title + ' ' + (result.snippet || ''));
  const inferredType = normalizeType(title + ' ' + (result.snippet || ''));

  return {
    id: 'tf-' + hashCode(url || title),
    title,
    field: overrides.field || inferredField || 'Technology',
    type: overrides.type || inferredType || 'Conference',
    city: overrides.city || 'India',
    startDate: overrides.dateFrom || new Date().toISOString().split('T')[0],
    endDate: overrides.dateFrom || new Date().toISOString().split('T')[0],
    venue: result.site_name || 'TBA',
    description: result.snippet || 'No description available.',
    registrationUrl: url,
    organizer: result.site_name || 'Unknown organizer',
    mode: url.includes('online') || url.includes('virtual') ? 'Online' : 'In-person',
    _source: 'tinyfish',
  };
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

async function fetchTinyFishEvents(filters) {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) {
    throw new Error('TINYFISH_API_KEY is not configured');
  }

  const parts = [];
  if (filters.type) parts.push(filters.type);
  if (filters.field) parts.push(filters.field);
  if (filters.city) parts.push('in ' + filters.city);
  parts.push('India students upcoming');
  const query = parts.join(' ');

  const url =
    TINYFISH_SEARCH_URL +
    '?query=' +
    encodeURIComponent(query) +
    '&location=IN&language=en&domain_type=web';

  const res = await fetch(url, {
    headers: {
      'X-API-Key': apiKey,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error('TinyFish search failed: ' + res.status + ' ' + text);
  }

  const data = await res.json();
  const results = Array.isArray(data.results) ? data.results : [];
  return results.map((r) => mapSearchResult(r, filters));
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

  try {
    const liveEvents = await fetchTinyFishEvents(filters);
    const merged = liveEvents.length > 0 ? liveEvents : filterSeedEvents(filters);
    res.status(200).json({
      source: liveEvents.length > 0 ? 'tinyfish' : 'seed',
      events: merged,
      query: filters,
    });
  } catch (err) {
    console.error('TinyFish fallback:', err.message);
    res.status(200).json({
      source: 'seed',
      events: filterSeedEvents(filters),
      query: filters,
      notice:
        'TinyFish API unavailable or unconfigured. Showing sample events. Add TINYFISH_API_KEY to enable live results.',
    });
  }
}
