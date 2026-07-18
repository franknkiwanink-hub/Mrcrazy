"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAgentModal } from "@/components/agent/AgentModalProvider";

// Ports core-early.js's path-router branch: `path === '/aiagent' &&
// window.__openAgentModal` — the original never rendered a real page here,
// it just opened the modal over whatever was already showing and reset the
// path to '/' on close (see AgentModal's onClose). Mirrored here: this
// route's only job is to open the modal, then immediately clear itself
// back to '/' so the URL bar doesn't get stuck on a route with no page
// content of its own once the modal is closed by the user.
export default function AiAgentPage() {
  const router = useRouter();
  const { openAgent } = useAgentModal();

  useEffect(() => {
    openAgent();
    router.replace("/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
