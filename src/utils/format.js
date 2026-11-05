export const formatMinutes = (min) => {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
};

export const formatServings = (s) => {
  if (!s) return '';
  const amount = s.quantity ? (s.max ? `${s.quantity}-${s.max}` : s.quantity) : s.original;
  return `${amount}${s.unit ? ` ${s.unit}` : ' porciones'}`;
};
