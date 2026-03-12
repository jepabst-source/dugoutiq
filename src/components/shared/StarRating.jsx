import { useState } from 'react';

export default function StarRating({ value = 0, onChange, max = 5, size = 'md', readOnly = false }) {
  const [hovered, setHovered] = useState(0);

  const sizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div className="flex gap-0.5" onMouseLeave={() => setHovered(0)}>
      {Array.from({ length: max }, (_, i) => i + 1).map(star => {
        const filled = hovered ? star <= hovered : star <= value;
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readOnly && setHovered(star)}
            className={`${sizes[size]} transition-transform duration-100
              ${readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-125'}
              ${filled ? 'text-gold' : 'text-border-light'}`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
