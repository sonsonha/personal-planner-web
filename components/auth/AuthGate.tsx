"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AuthApiError,
  fetchAuthMe,
  logoutPersonalOs,
  type AuthUser,
} from "@/lib/auth-api";
import { captureReturnPath, consumeReturnPath } from "@/lib/auth-return";
import { AccessDisabledScreen } from "@/components/auth/AccessDisabledScreen";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { OnboardingFlow } from "@/components/auth/OnboardingFlow";
import { PlannerApp } from "@/app/planner-app";

type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "disabled"; message: string }
  | { status: "authenticated"; user: AuthUser };

const PLANNER_PREFIXES = ["/calendar", "/tasks", "/projects", "/goals", "/progress", "/finance"];

function isPlannerPath(pathname: string) {
  return PLANNER_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function needsOnboarding(user: AuthUser) {
  return !user.onboardingCompletedAt;
}

export function AuthGate({
  chatgptViewer,
  children,
}: {
  chatgptViewer: { displayName: string; email: string } | null;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  const enterApp = useCallback((user: AuthUser) => {
    setAuth({ status: "authenticated", user });
    if (needsOnboarding(user)) return;
    const next = consumeReturnPath("/calendar");
    router.replace(next);
  }, [router]);

  const refreshAuth = useCallback(async () => {
    try {
      const result = await fetchAuthMe();
      setAuth({ status: "authenticated", user: result.user });
    } catch (err) {
      if (err instanceof AuthApiError && err.code === "ACCOUNT_NOT_ENABLED") {
        setAuth({
          status: "disabled",
          message: "This account does not have access to Personal OS yet.",
        });
        return;
      }
      setAuth({ status: "anonymous" });
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    if (needsOnboarding(auth.user)) return;
    if (pathname === "/login") {
      router.replace(consumeReturnPath("/calendar"));
    }
  }, [auth, pathname, router]);

  useEffect(() => {
    if (auth.status === "loading") return;
    if (auth.status === "authenticated") return;
    if (auth.status === "disabled") return;
    if (pathname === "/login") return;
    if (isPlannerPath(pathname) || pathname === "/") {
      captureReturnPath(pathname);
      router.replace("/login");
    }
  }, [auth.status, pathname, router]);

  const onAuthenticated = useCallback((user: AuthUser) => {
    enterApp(user);
  }, [enterApp]);

  const onOnboardingCompleted = useCallback((user: AuthUser) => {
    setAuth({ status: "authenticated", user });
    router.replace(consumeReturnPath("/calendar"));
  }, [router]);

  const onSignOut = useCallback(async () => {
    try {
      await logoutPersonalOs();
    } catch {
      // Cookie clear may still succeed server-side; force local logout.
    }
    setAuth({ status: "anonymous" });
    router.replace("/login");
  }, [router]);

  if (auth.status === "loading") {
    return (
      <div className="pos-login-shell">
        <div className="pos-login-panel">
          <p className="pos-login-brand">Personal OS</p>
          <p className="pos-login-status">Checking session…</p>
        </div>
      </div>
    );
  }

  if (auth.status === "disabled") {
    return (
      <AccessDisabledScreen message={auth.message} onSignOut={onSignOut} />
    );
  }

  if (auth.status === "authenticated" && needsOnboarding(auth.user)) {
    return (
      <OnboardingFlow user={auth.user} onCompleted={onOnboardingCompleted} />
    );
  }

  if (auth.status === "anonymous" || pathname === "/login") {
    return <LoginScreen onAuthenticated={onAuthenticated} />;
  }

  const user = auth.status === "authenticated" ? auth.user : null;

  return (
    <>
      <PlannerApp
        key={user?.id ?? "anon"}
        viewer={
          user
            ? {
                displayName: user.name ?? user.email,
                email: user.email,
                avatarUrl: user.avatarUrl,
              }
            : chatgptViewer
        }
        onSignOut={onSignOut}
      />
      {children}
    </>
  );
}
