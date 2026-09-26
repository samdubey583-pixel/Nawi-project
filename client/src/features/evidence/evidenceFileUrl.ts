import axios from 'axios';

/** Build evidence URLs against the same API origin used by the app's requests. */
export function evidenceFileUrl(path: string, apiBase = String(axios.defaults.baseURL || '')) {
  const base = apiBase.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
