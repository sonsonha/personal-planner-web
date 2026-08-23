export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  onboardingCompletedAt: string | null;
};

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

async function authJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string };
  } & T;
  if (!response.ok) {
    throw new AuthApiError(
      payload.error?.message ?? "Auth request failed",
      response.status,
      payload.error?.code ?? "AUTH_REQUEST_FAILED",
    );
  }
  return payload;
}

export function fetchAuthConfig() {
  return authJson<{ googleClientId: string | null; identityEnabled: boolean }>(
    "/api/auth/config",
  );
}

export function fetchAuthMe() {
  return authJson<{ user: AuthUser }>("/api/auth/me");
}

export function loginWithGoogleIdToken(idToken: string) {
  return authJson<{ user: AuthUser }>("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });
}

export function completeOnboarding() {
  return authJson<{ user: AuthUser }>("/api/auth/onboarding/complete", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function logoutPersonalOs() {
  return authJson<{ ok: true }>("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({}),
  });
}
