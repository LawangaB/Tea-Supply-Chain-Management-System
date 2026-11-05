import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  withCredentials: true, // send the httpOnly session cookie
  timeout: 20000,
});

let onUnauthorized = () => {};
/** AuthContext registers a handler so an expired session sends the user back to sign-in. */
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    if (err.response?.status === 401 && !url.includes('/auth/')) onUnauthorized();
    return Promise.reject(err);
  },
);

/**
 * Normalises any axios error into { status, code, message, fields: { fieldName: message } }.
 * The API always answers with { error: { code, message, fields: [{ field, message }] } }.
 */
export function apiError(err) {
  if (!err?.response) {
    return { status: 0, code: 'NETWORK', message: 'Cannot reach the server. Check your connection and try again.', fields: {} };
  }
  const e = err.response.data?.error || {};
  const fields = {};
  for (const f of e.fields || []) if (!fields[f.field]) fields[f.field] = f.message;
  return { status: err.response.status, code: e.code, message: e.message || 'Something went wrong', fields };
}
