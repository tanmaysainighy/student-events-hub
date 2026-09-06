const TINYFISH_SEARCH_URL = 'https://api.search.tinyfish.ai/';
const TINYFISH_FETCH_URL = 'https://api.fetch.tinyfish.ai';
const TINYFISH_AGENT_URL = 'https://agent.tinyfish.ai/v1/automation/run';

function getApiKey() {
  const key = process.env.TINYFISH_API_KEY;
  if (!key) throw new Error('TINYFISH_API_KEY is not configured');
  return key;
}

export async function searchTinyFish({ query, purpose, afterDate, fetchConfig, location = 'IN', language = 'en' }) {
  const params = new URLSearchParams();
  params.set('query', query);
  if (purpose) params.set('purpose', purpose);
  params.set('location', location);
  params.set('language', language);
  params.set('domain_type', 'web');
  if (afterDate) params.set('after_date', afterDate);
  if (fetchConfig) params.set('fetch', JSON.stringify(fetchConfig));

  const res = await fetch(TINYFISH_SEARCH_URL + '?' + params.toString(), {
    headers: {
      'X-API-Key': getApiKey(),
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error('TinyFish Search failed (' + res.status + '): ' + text);
  }

  const data = await res.json();
  return Array.isArray(data.results) ? data.results : [];
}

export async function fetchUrls(urls) {
  if (!urls.length) return [];

  const res = await fetch(TINYFISH_FETCH_URL, {
    method: 'POST',
    headers: {
      'X-API-Key': getApiKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      urls,
      format: 'markdown',
      per_url_timeout_ms: 20000,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error('TinyFish Fetch failed (' + res.status + '): ' + text);
  }

  const data = await res.json();
  return Array.isArray(data.results) ? data.results : [];
}

export async function extractEventsWithAgent(url, filters, timeoutMs = 25000) {
  const outputSchema = {
    type: 'object',
    properties: {
      events: {
        type: 'array',
        maxItems: 4,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date', nullable: true },
            city: { type: 'string' },
            venue: { type: 'string', nullable: true },
            organizer: { type: 'string', nullable: true },
            registrationUrl: { type: 'string' },
            mode: {
              type: 'string',
              enum: ['In-person', 'Online', 'Hybrid'],
            },
            type: { type: 'string' },
            field: { type: 'string' },
          },
          required: ['title', 'startDate', 'city'],
        },
      },
    },
    required: ['events'],
  };

  const goalParts = [
    'Extract upcoming student-relevant events from this page.',
  ];
  if (filters.city) goalParts.push('Prioritize events in or near ' + filters.city + ', India.');
  if (filters.field) goalParts.push('Focus on ' + filters.field + '.');
  if (filters.type) goalParts.push('Include ' + filters.type + ' events.');
  goalParts.push(
    'Return a JSON list of events with title, description, startDate (YYYY-MM-DD), endDate if available, city, venue, organizer, registrationUrl, mode (In-person/Online/Hybrid), event type, and field.',
    'Ignore past events. If no relevant events are found, return an empty list.'
  );

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(TINYFISH_AGENT_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'X-API-Key': getApiKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        goal: goalParts.join(' '),
        output_schema: outputSchema,
        browser_profile: 'lite',
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text();
      throw new Error('TinyFish Agent failed (' + res.status + '): ' + text);
    }

    const data = await res.json();
    const events = data.result?.events || data.result?.result?.events || [];
    return events.map((e) => ({ ...e, _sourceUrl: url }));
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Agent extraction timed out for ' + url);
    }
    throw err;
  }
}
