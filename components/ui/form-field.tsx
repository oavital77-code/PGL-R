import * as React from "react";
import { Label } from "./label";
import { cn } from "@/lib/utils/cn";

interface FieldProps {
  label: React.ReactNode;
  htmlFor?: string;
  error?: string | string[] | undefined;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** Label + control + inline error (spec §16.5). */
export function Field({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  const err = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-destructive ms-1">*</span> : null}
      </Label>
      {children}
      {err ? (
        <p className="text-xs text-destructive" role="alert">
          {err}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
