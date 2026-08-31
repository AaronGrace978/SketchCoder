"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { StudioApp } from "@/components/studio/StudioApp";

function StudioInner() {
  const demo = useSearchParams().get("demo") === "rag";
  return <StudioApp loadDemo={demo} />;
}

export default function StudioPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-ink" />}>
      <StudioInner />
    </Suspense>
  );
}
