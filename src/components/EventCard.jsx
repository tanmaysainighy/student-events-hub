import { MapPin, Calendar, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { FavoriteButton } from './FavoriteButton';

export function EventCard({ event, isFavorite, onToggleFavorite, onClick }) {
  const dateDisplay =
    event.startDate === event.endDate
      ? format(new Date(event.startDate), 'MMM d, yyyy')
      : format(new Date(event.startDate), 'MMM d') +
        ' - ' +
        format(new Date(event.endDate), 'MMM d, yyyy');

  const fieldColors = {
    Technology: 'badge-tech',
    Design: 'badge-design',
    Business: 'badge-business',
    'Data Science': 'badge-data',
    Product: 'badge-product',
  };

  return (
    <article className="event-card" onClick={onClick} role="button" tabIndex={0}>
      <div className="event-card-header">
        <span className={'badge ' + (fieldColors[event.field] || 'badge-default')}>
          {event.field}
        </span>
        <FavoriteButton isFavorite={isFavorite} onToggle={onToggleFavorite} />
      </div>
      <h3 className="event-card-title">{event.title}</h3>
      <p className="event-card-type">{event.type}</p>
      <div className="event-card-meta">
        <span>
          <Calendar size={14} /> {dateDisplay}
        </span>
        <span>
          <MapPin size={14} /> {event.city}
        </span>
      </div>
      <p className="event-card-venue">{event.venue}</p>
      <p className="event-card-description">{event.description}</p>
      <div className="event-card-footer">
        <span className="organizer">by {event.organizer}</span>
        <a
          href={event.registrationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="register-link"
          onClick={(e) => e.stopPropagation()}
        >
          Register <ExternalLink size={12} />
        </a>
      </div>
    </article>
  );
}
