import { useEffect, useMemo, useState } from 'react';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { EventCard } from './components/EventCard';
import { EventModal } from './components/EventModal';
import { useLocalStorage } from './hooks/useLocalStorage';
import { seedEvents } from './data/seedEvents';
import { Loader2, AlertCircle, Sparkles, Heart } from 'lucide-react';

const API_URL = '/api/events';

function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState('seed');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [favorites, setFavorites] = useLocalStorage('se:favorites', []);
  const [filters, setFilters] = useState({
    search: '',
    city: '',
    field: '',
    type: '',
    dateFrom: '',
  });

  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filters.city) params.set('city', filters.city);
        if (filters.field) params.set('field', filters.field);
        if (filters.type) params.set('type', filters.type);
        if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);

        const url = API_URL + (params.toString() ? '?' + params.toString() : '');
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load events');
        const data = await res.json();
        if (!cancelled) {
          setEvents(data.events || []);
          setSource(data.source || 'seed');
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError('Could not reach the events API. Showing sample data instead.');
          setEvents(seedEvents);
          setSource('seed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEvents();
    return () => {
      cancelled = true;
    };
  }, [filters.city, filters.field, filters.type, filters.dateFrom]);

  const filteredEvents = useMemo(() => {
    const term = filters.search.toLowerCase().trim();
    if (!term) return events;
    return events.filter((event) => {
      return (
        event.title.toLowerCase().includes(term) ||
        event.description.toLowerCase().includes(term) ||
        event.organizer.toLowerCase().includes(term) ||
        event.venue.toLowerCase().includes(term)
      );
    });
  }, [events, filters.search]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({ search: '', city: '', field: '', type: '', dateFrom: '' });
  };

  const toggleFavorite = (id) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="app">
      <Header />

      <main className="main">
        <FilterBar
          filters={filters}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
        />

        <div className="status-bar">
          <p>
            {loading ? (
              <span className="status-loading">
                <Loader2 size={16} className="spin" /> Loading events…
              </span>
            ) : (
              <span>
                <strong>{filteredEvents.length}</strong>{' '}
                {filteredEvents.length === 1 ? 'event' : 'events'} found
              </span>
            )}
          </p>
          {source === 'tinyfish' && (
            <span className="live-badge">
              <Sparkles size={14} /> Live results via TinyFish
            </span>
          )}
          {source === 'seed' && !loading && (
            <span className="seed-badge">
              Sample data — add TinyFish key for live results
            </span>
          )}
        </div>

        {error && (
          <div className="error-banner">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {filteredEvents.length === 0 && !loading ? (
          <div className="empty-state">
            <Heart size={48} className="empty-icon" />
            <h2>No events match your filters</h2>
            <p>Try clearing filters or searching for a different topic.</p>
            <button className="button-primary" onClick={handleClearFilters}>
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="events-grid">
            {filteredEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                isFavorite={favorites.includes(event.id)}
                onToggleFavorite={() => toggleFavorite(event.id)}
                onClick={() => setSelectedEvent(event)}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="footer">
        <p>
          Built for students. Live event data powered by{' '}
          <a href="https://tinyfish.ai" target="_blank" rel="noopener noreferrer">
            TinyFish
          </a>
          .
        </p>
      </footer>

      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          isFavorite={favorites.includes(selectedEvent.id)}
          onToggleFavorite={() => toggleFavorite(selectedEvent.id)}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}

export default App;
