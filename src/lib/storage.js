// The browser remembers which runs it created (and their owner tokens).
// Wrapped in try/catch: storage can be unavailable in private windows.

const KEY = "constellation.runs.v1";

export function myRuns() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function rememberRun(id, token) {
  try {
    const list = myRuns().filter((r) => r.id !== id);
    list.unshift({ id, token, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 40)));
  } catch {
    /* ignore */
  }
}

export function forgetRun(id) {
  try {
    localStorage.setItem(KEY, JSON.stringify(myRuns().filter((r) => r.id !== id)));
  } catch {
    /* ignore */
  }
}

export function tokenFor(id) {
  return myRuns().find((r) => r.id === id)?.token || null;
}
