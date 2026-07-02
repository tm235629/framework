import { useState, useEffect } from 'react';

// Persist a piece of UI state to localStorage under `key` (JSON-encoded). Backs
// the active tab (App), the Sync tab's verticals view (flat↔verticals toggle +
// each accordion's open/closed state), Projects/Sync sort, etc. Fails soft in
// private mode / on quota.
export function usePersistentState(key, initial) {
  const [val, setVal] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw != null ? JSON.parse(raw) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
  }, [key, val]);
  return [val, setVal];
}
