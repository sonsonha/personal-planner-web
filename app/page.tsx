import { getChatGPTUser } from "./chatgpt-auth";
import { PlannerApp } from "./planner-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const viewer = await getChatGPTUser();
  return (
    <PlannerApp
      viewer={viewer ? { displayName: viewer.displayName, email: viewer.email } : null}
    />
  );
}
