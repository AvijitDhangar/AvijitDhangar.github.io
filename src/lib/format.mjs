export const fmtDate = (d) => d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
export const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
