export const BASE = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');
export const withBase = (p = '') => BASE + String(p).replace(/^\/+/, '');
