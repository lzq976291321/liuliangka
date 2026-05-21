export function getBrowserVisitorId() {
  const fallbackId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  if (typeof window === "undefined") {
    return `v_${fallbackId}`;
  }

  try {
    const storageKey = "liuliangka_visitor_id";
    const current = window.localStorage.getItem(storageKey);
    if (current) {
      return current;
    }

    const next = `v_${window.crypto?.randomUUID?.() ?? fallbackId}`;
    window.localStorage.setItem(storageKey, next);
    return next;
  } catch {
    return `v_${fallbackId}`;
  }
}
