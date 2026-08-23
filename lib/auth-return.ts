/** Safe post-login return paths (no open redirect). */

const RETURN_STORAGE_KEY = "pos_return_to";

const ALLOWED_PREFIXES = [
  "/calendar",
  "/tasks",
  "/projects",
  "/goals",
  "/progress",
] as const;

/** In-memory fallback when sessionStorage is unavailable (SSR / Node tests). */
const memoryStore = new Map<string, string>();

function storageGet(key: string): string | null {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      return window.sessionStorage.getItem(key);
    }
  } catch {
    // ignore
  }
  return memoryStore.get(key) ?? null;
}

function storageSet(key: string, value: string): void {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.setItem(key, value);
      return;
    }
  } catch {
    // fall through to memory
  }
  memoryStore.set(key, value);
}

function storageRemove(key: string): void {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
  memoryStore.delete(key);
}

export function isAllowlistedReturnPath(pathname: string): boolean {
  if (!pathname.startsWith("/") || pathname.startsWith("//") || pathname.includes("://")) {
    return false;
  }
  return ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function captureReturnPath(pathname: string): void {
  if (pathname === "/login" || pathname === "/") return;
  if (!isAllowlistedReturnPath(pathname)) return;
  storageSet(RETURN_STORAGE_KEY, pathname);
}

export function consumeReturnPath(fallback = "/calendar"): string {
  const raw = storageGet(RETURN_STORAGE_KEY);
  storageRemove(RETURN_STORAGE_KEY);
  if (!raw || !isAllowlistedReturnPath(raw)) return fallback;
  return raw;
}
