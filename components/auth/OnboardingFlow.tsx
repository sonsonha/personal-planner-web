"use client";

import { useState } from "react";
import { completeOnboarding, type AuthUser } from "@/lib/auth-api";
import { getGoogleAuthUrl } from "@/lib/planner-api";

type OnboardingFlowProps = {
  user: AuthUser;
  onCompleted: (user: AuthUser) => void;
};

export function OnboardingFlow({ user, onCompleted }: OnboardingFlowProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishWithoutCalendar = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await completeOnboarding();
      onCompleted(result.user);
    } catch {
      setError("Could not continue. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const connectCalendar = async () => {
    setBusy(true);
    setError(null);
    try {
      // Mark onboarding done before OAuth so return does not re-show Welcome.
      await completeOnboarding();
      const result = await getGoogleAuthUrl();
      if (!result.url) throw new Error("OAuth unavailable");
      window.location.assign(result.url);
    } catch {
      setError("Could not start Google Calendar connection.");
      setBusy(false);
    }
  };

  return (
    <div className="pos-login-shell">
      <div className="pos-login-panel pos-onboarding-panel">
        <p className="pos-login-brand">Personal OS</p>
        {step === 1 ? (
          <>
            <h1 className="pos-login-title">Welcome to Personal OS</h1>
            <p className="pos-login-copy">
              Plan Goals and Projects, turn work into Tasks, and protect time on your Calendar.
            </p>
            <div className="pos-login-actions">
              <button
                type="button"
                className="pos-btn-primary"
                disabled={busy}
                onClick={() => setStep(2)}
              >
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="pos-login-title">Connect Google Calendar</h1>
            <p className="pos-login-copy">
              Personal OS can read your existing commitments and place your scheduled work into
              a dedicated Personal OS calendar.
            </p>
            <p className="pos-login-hint">
              Calendar is optional. You can connect later from the app.
            </p>
            <div className="pos-login-actions pos-onboarding-actions">
              <button
                type="button"
                className="pos-btn-primary"
                disabled={busy}
                onClick={() => void connectCalendar()}
              >
                {busy ? "Connecting…" : "Connect Google Calendar"}
              </button>
              <button
                type="button"
                className="pos-btn-secondary"
                disabled={busy}
                onClick={() => void finishWithoutCalendar()}
              >
                Not now
              </button>
            </div>
          </>
        )}
        {error ? (
          <p className="pos-login-error" role="alert">
            {error}
          </p>
        ) : null}
        <p className="pos-login-status pos-onboarding-signed-in">
          Signed in as {user.name ?? user.email}
        </p>
      </div>
    </div>
  );
}
