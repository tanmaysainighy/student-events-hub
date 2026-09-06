import { Calendar, MapPin } from 'lucide-react';

export function Header() {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <div className="logo-icon">
            <Calendar size={24} />
          </div>
          <span className="logo-text">StudentEvents</span>
        </div>
        <p className="tagline">
          <MapPin size={16} /> Find workshops, hackathons & conferences in your city
        </p>
      </div>
    </header>
  );
}
