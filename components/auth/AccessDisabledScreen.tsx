"use client";

type AccessDisabledScreenProps = {
  message?: string;
  onSignOut: () => void | Promise<void>;
};

export function AccessDisabledScreen({
  message = "This account does not have access to Personal OS yet.",
  onSignOut,
}: AccessDisabledScreenProps) {
  return (
    <div className="pos-login-shell">
      <div className="pos-login-panel">
        <p className="pos-login-brand">Personal OS</p>
        <h1 className="pos-login-title">Access not available</h1>
        <p className="pos-login-copy">{message}</p>
        <p className="pos-login-hint">
          Google sign-in worked. This Google account is not on the Personal OS allowlist yet.
        </p>
        <div className="pos-login-actions pos-onboarding-actions">
          <button
            type="button"
            className="pos-btn-primary"
            onClick={() => void onSignOut()}
          >
            Sign out
          </button>
          <button
            type="button"
            className="pos-btn-secondary"
            onClick={() => void onSignOut()}
          >
            Try another Google account
          </button>
        </div>
      </div>
    </div>
  );
}
