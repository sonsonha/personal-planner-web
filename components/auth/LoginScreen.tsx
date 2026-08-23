"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AuthApiError,
  fetchAuthConfig,
  loginWithGoogleIdToken,
  type AuthUser,
} from "@/lib/auth-api";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            ux_mode?: "popup" | "redirect";
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "continue_with";
              shape?: "rectangular" | "pill";
              width?: number;
            },
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

type LoginScreenProps = {
  onAuthenticated: (user: AuthUser) => void;
};

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-pos-gis="1"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("GIS load failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.posGis = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("GIS load failed"));
    document.head.appendChild(script);
  });
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleCredential = useCallback(async (credential: string) => {
    setBusy(true);
    setError(null);
    try {
      const result = await loginWithGoogleIdToken(credential);
      onAuthenticated(result.user);
    } catch (err) {
      if (err instanceof AuthApiError && err.code === "ACCOUNT_NOT_ENABLED") {
        setError("This account does not have access to Personal OS yet.");
      } else if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError("Could not sign in with Google");
      }
    } finally {
      setBusy(false);
    }
  }, [onAuthenticated]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await fetchAuthConfig();
        if (cancelled) return;
        if (!config.googleClientId) {
          setError("Google Sign-In is not configured");
          return;
        }
        await loadGisScript();
        if (cancelled || !buttonRef.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: (response) => {
            void handleCredential(response.credential);
          },
          ux_mode: "popup",
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        buttonRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          width: 280,
        });
        setReady(true);
      } catch {
        if (!cancelled) setError("Could not load Google Sign-In");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handleCredential]);

  return (
    <div className="pos-login-shell">
      <div className="pos-login-panel">
        <p className="pos-login-brand">Personal OS</p>
        <h1 className="pos-login-title">Plan goals, work, and time in one place.</h1>
        <p className="pos-login-copy">Sign in with your Google account.</p>
        <div className="pos-login-actions">
          <div
            ref={buttonRef}
            className="pos-login-gis"
            aria-busy={!ready || busy}
            aria-label="Continue with Google"
          />
          {busy ? <p className="pos-login-status">Signing in…</p> : null}
          {error ? <p className="pos-login-error" role="alert">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
