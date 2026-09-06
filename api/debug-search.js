export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'TINYFISH_API_KEY not set' });
  }

  const queries = req.query.q
    ? [req.query.q]
    : [
        'Bengaluru hackathon 2025',
        'Technology events Bengaluru India',
        'devfolio Bengaluru hackathon',
        'student hackathon India 2025',
      ];

  const results = await Promise.all(
    queries.map(async (q) => {
      const url =
        'https://api.search.tinyfish.ai/?query=' +
        encodeURIComponent(q) +
        '&location=IN&language=en&domain_type=web';
      try {
        const r = await fetch(url, {
          headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
        });
        const data = await r.json();
        return {
          query: q,
          status: r.status,
          total: data.total_results ?? null,
          resultCount: Array.isArray(data.results) ? data.results.length : 0,
          firstResults: Array.isArray(data.results)
            ? data.results.slice(0, 3).map((x) => ({ title: x.title, url: x.url }))
            : [],
          error: data.error || null,
        };
      } catch (err) {
        return { query: q, error: err.message };
      }
    })
  );

  res.status(200).json({ queries: results });
}
