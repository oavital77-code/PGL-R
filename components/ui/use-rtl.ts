"use client";
import { useDirection } from "@radix-ui/react-direction";

/** True when the page is right-to-left (the direction the root layout gives the DirectionProvider). */
export function useRtl(): boolean {
  return useDirection() === "rtl";
}
