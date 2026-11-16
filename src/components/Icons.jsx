// Íconos SVG de línea consistentes para estética editorial / etiqueta de almacén
// Sin dependencias externas, livianos y accesibles con aria-hidden.

export function Icon({ name, size = 18, className = '', ...props }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: `ico ico-${name} ${className}`.trim(),
    'aria-hidden': 'true',
    ...props,
  };

  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5z" />
        </svg>
      );
    case 'fridge':
      return (
        <svg {...common}>
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <line x1="5" y1="10" x2="19" y2="10" />
          <line x1="9" y1="5" x2="9" y2="8" />
          <line x1="9" y1="13" x2="9" y2="17" />
        </svg>
      );
    case 'recipes':
      return (
        <svg {...common}>
          <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
          <line x1="6" y1="1" x2="6" y2="4" />
          <line x1="10" y1="1" x2="10" y2="4" />
          <line x1="14" y1="1" x2="14" y2="4" />
        </svg>
      );
    case 'plan':
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'shop':
    case 'cart':
      return (
        <svg {...common}>
          <circle cx="9" cy="20" r="1.5" />
          <circle cx="18" cy="20" r="1.5" />
          <path d="M2 3h3.5l2.2 11.2a1 1 0 0 0 1 .8h9.8a1 1 0 0 0 1-.8L21 6H6" />
        </svg>
      );
    case 'menu':
      return (
        <svg {...common}>
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      );
    case 'close':
      return (
        <svg {...common}>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...common}>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      );
    case 'minus':
      return (
        <svg {...common}>
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case 'trash':
      return (
        <svg {...common}>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15 15" />
        </svg>
      );
    case 'alert':
      return (
        <svg {...common}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'arrow-right':
      return (
        <svg {...common}>
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      );
    case 'undo':
      return (
        <svg {...common}>
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg {...common}>
          <path d="M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4z" />
        </svg>
      );
    case 'pot':
      return (
        <svg {...common}>
          <path d="M4 11h16v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-7z" />
          <path d="M3 11h18" />
          <path d="M12 5v3" />
          <path d="M8 8h8" />
        </svg>
      );
    case 'grip':
    case 'drag-handle':
      return (
        <svg {...common}>
          <circle cx="9" cy="6" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="15" cy="6" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="9" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="9" cy="18" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="15" cy="18" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'edit':
      return (
        <svg {...common}>
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      );
    case 'swap':
    case 'move':
      return (
        <svg {...common}>
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      );
    default:
      return null;
  }
}

// Ilustraciones SVG editoriales para estados vacíos (minimalistas, tinta de imprenta)
export function EmptyGraphic({ type = 'fridge' }) {
  if (type === 'fridge') {
    return (
      <svg className="empty-svg" width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="16" y="8" width="32" height="48" rx="4" />
        <line x1="16" y1="24" x2="48" y2="24" />
        <line x1="22" y1="15" x2="22" y2="19" />
        <line x1="22" y1="32" x2="22" y2="40" />
        <circle cx="32" cy="40" r="4" strokeDasharray="2 2" />
      </svg>
    );
  }
  if (type === 'dish' || type === 'meal') {
    return (
      <svg className="empty-svg" width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="32" cy="32" r="22" />
        <circle cx="32" cy="32" r="14" strokeDasharray="3 3" />
        <path d="M8 20v24" />
        <path d="M56 20v24" />
      </svg>
    );
  }
  if (type === 'cart') {
    return (
      <svg className="empty-svg" width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="24" cy="50" r="4" />
        <circle cx="44" cy="50" r="4" />
        <path d="M12 14h8l5 24h24l4-18H18" />
      </svg>
    );
  }
  return null;
}
