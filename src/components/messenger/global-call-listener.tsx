"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { CallUI } from "@/components/messenger/call-ui";
import { useCall } from "@/components/messenger/use-call";
import type { AuthorSummary } from "@/types/social";

/**
 * App-wide incoming-call coverage. The messenger mounts its own call stack on
 * /messages; everywhere else this listener subscribes to the same personal
 * ring channel so a call rings — loudly, with the full accept/decline overlay
 * — no matter which page the user is on. Exactly one call stack runs per tab:
 * on /messages this renders nothing.
 */
export function GlobalCallListener({
  currentUser,
}: {
  currentUser: AuthorSummary;
}) {
  const pathname = usePathname();
  if (pathname === "/messages" || pathname.startsWith("/messages/")) {
    return null;
  }
  return <GlobalCallStack currentUser={currentUser} />;
}

function GlobalCallStack({ currentUser }: { currentUser: AuthorSummary }) {
  // Call logs are written to the conversation by useCall itself; the callback
  // only feeds the messenger's optimistic UI, which isn't mounted here.
  const call = useCall(currentUser);
  return <CallUI call={call} />;
}
