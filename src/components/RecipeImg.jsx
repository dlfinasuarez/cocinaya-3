import { useEffect, useState } from 'react';

// Las fotos son de los sitios que publicaron la receta: si una no carga, mostramos un plato.
export default function RecipeImg({ src, alt = '', className = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return <div className={`img-fallback ${className}`} role="img" aria-label={alt || 'Sin foto'}>🍽️</div>;
  }
  return <img className={className} src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}
