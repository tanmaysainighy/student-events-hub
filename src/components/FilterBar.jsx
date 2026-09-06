import { Search, SlidersHorizontal, X } from 'lucide-react';
import { CITIES, FIELDS, EVENT_TYPES } from '../data/seedEvents';

export function FilterBar({ filters, onChange, onClear }) {
  const hasFilters =
    filters.search || filters.city || filters.field || filters.type || filters.dateFrom;

  return (
    <div className="filter-bar">
      <div className="filter-row search-row">
        <div className="search-input-wrapper">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search events, topics, or organizers..."
            value={filters.search}
            onChange={(e) => onChange('search', e.target.value)}
            className="search-input"
          />
        </div>
        {hasFilters && (
          <button type="button" className="clear-button" onClick={onClear}>
            <X size={16} /> Clear
          </button>
        )}
      </div>

      <div className="filter-row">
        <div className="filter-group">
          <SlidersHorizontal size={16} />
          <select value={filters.city} onChange={(e) => onChange('city', e.target.value)}>
            <option value="">All cities</option>
            {CITIES.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <select value={filters.field} onChange={(e) => onChange('field', e.target.value)}>
            <option value="">All fields</option>
            {FIELDS.map((field) => (
              <option key={field} value={field}>
                {field}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <select value={filters.type} onChange={(e) => onChange('type', e.target.value)}>
            <option value="">All event types</option>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group date-group">
          <label>From</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onChange('dateFrom', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
