"use client";

import dynamic from "next/dynamic";
import React from "react";

const Agent = dynamic(() => import("@/components/Agent"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[280px] w-full items-center justify-center rounded-2xl border-2 border-primary-200/40 bg-dark-200">
      <p className="text-muted-foreground">Loading interview…</p>
    </div>
  ),
});

export default function AgentLoader(props: AgentProps) {
  return <Agent {...props} />;
}
