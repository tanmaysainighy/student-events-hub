import { Heart } from 'lucide-react';

export function FavoriteButton({ isFavorite, onToggle }) {
  return (
    <button
      type="button"
      className={'favorite-button' + (isFavorite ? ' favorite-active' : '')}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
    </button>
  );
}
