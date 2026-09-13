"use client";
import { useTransition } from "react";
import { markNotificationsRead } from "@/lib/notifications/actions";

export function MarkAllReadButton({ label }: { label: string }) {
  const [pending, start] = useTransition();
  return (
    <button className="text-xs text-primary hover:underline disabled:opacity-50" disabled={pending} onClick={() => start(() => markNotificationsRead("all"))}>
      {label}
    </button>
  );
}
