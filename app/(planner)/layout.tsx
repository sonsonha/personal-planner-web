import type { ReactNode } from "react";
import { getChatGPTUser } from "../chatgpt-auth";
import { AuthGate } from "@/components/auth/AuthGate";

export default async function PlannerLayout({
  children,
}: {
  children: ReactNode;
}) {
  const viewer = await getChatGPTUser();
  return (
    <AuthGate
      chatgptViewer={viewer ? { displayName: viewer.displayName, email: viewer.email } : null}
    >
      {children}
    </AuthGate>
  );
}
