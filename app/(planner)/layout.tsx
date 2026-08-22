import type { ReactNode } from "react";
import { getChatGPTUser } from "../chatgpt-auth";
import { PlannerApp } from "../planner-app";

export default async function PlannerLayout({
  children,
}: {
  children: ReactNode;
}) {
  const viewer = await getChatGPTUser();
  return (
    <>
      <PlannerApp
        viewer={viewer ? { displayName: viewer.displayName, email: viewer.email } : null}
      />
      {children}
    </>
  );
}
