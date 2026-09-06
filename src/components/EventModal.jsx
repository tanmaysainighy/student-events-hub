import { useEffect } from 'react';
import { X, MapPin, Calendar, Building2, Users, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { FavoriteButton } from './FavoriteButton';

export function EventModal({ event, isFavorite, onToggleFavorite, onClose }) {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  if (!event) return null;

  const dateDisplay =
    event.startDate === event.endDate
      ? format(new Date(event.startDate), 'MMMM d, yyyy')
      : format(new Date(event.startDate), 'MMMM d') +
        ' - ' +
        format(new Date(event.endDate), 'MMMM d, yyyy');

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        <div className="modal-header">
          <span className="modal-type">{event.type}</span>
          <h2>{event.title}</h2>
        </div>

        <div className="modal-actions">
          <FavoriteButton isFavorite={isFavorite} onToggle={onToggleFavorite} />
        </div>

        <div className="modal-grid">
          <div className="modal-field">
            <Calendar size={18} />
            <div>
              <span className="label">Date</span>
              <span className="value">{dateDisplay}</span>
            </div>
          </div>
          <div className="modal-field">
            <MapPin size={18} />
            <div>
              <span className="label">City</span>
              <span className="value">{event.city}</span>
            </div>
          </div>
          <div className="modal-field">
            <Building2 size={18} />
            <div>
              <span className="label">Venue</span>
              <span className="value">{event.venue}</span>
            </div>
          </div>
          <div className="modal-field">
            <Users size={18} />
            <div>
              <span className="label">Organizer</span>
              <span className="value">{event.organizer}</span>
            </div>
          </div>
        </div>

        <div className="modal-section">
          <h3>About this event</h3>
          <p>{event.description}</p>
        </div>

        <div className="modal-footer">
          <span className="mode-badge">{event.mode}</span>
          <a
            href={event.registrationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="register-button"
          >
            Register now <ExternalLink size={16} />
          </a>
        </div>
      </div>
    </div>
  );
}
