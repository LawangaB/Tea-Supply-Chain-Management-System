import { useCallback, useEffect, useState } from 'react';
import { api, apiError } from './client.js';

/**
 * GET `url` (with optional params) and re-fetch when they change. Pass url=null to skip.
 * Data from a previous url/params is never returned for the current one.
 */
export function useFetch(url, params) {
  const key = url ? `${url}?${JSON.stringify(params ?? {})}` : null;
  const [state, setState] = useState({ key: null, data: null, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!key) return undefined;
    const ctrl = new AbortController();
    api.get(url, { params: JSON.parse(key.slice(url.length + 1)), signal: ctrl.signal })
      .then((res) => setState({ key, data: res.data, error: null }))
      .catch((err) => { if (!ctrl.signal.aborted) setState({ key, data: null, error: apiError(err) }); });
    return () => ctrl.abort();
  }, [url, key, tick]);

  const current = key !== null && state.key === key;
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((data) => setState((s) => ({ ...s, data })), []);
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: key !== null && !current,
    reload,
    setData,
  };
}
