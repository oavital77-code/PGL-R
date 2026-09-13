"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions/result";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils/cn";

type FieldErrors = Record<string, string[]>;
const Ctx = React.createContext<FieldErrors>({});
export function useFieldErrors() {
  return React.useContext(Ctx);
}

interface Props<T> {
  action: (fd: FormData) => Promise<ActionResult<T>>;
  onSuccess?: (data: T) => void;
  successMessage?: string;
  submitLabel?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  resetOnSuccess?: boolean;
  hideSubmit?: boolean;
  refresh?: boolean;
}

/** Generic <form> wrapper around a server action returning ActionResult. */
export function ActionForm<T>({ action, onSuccess, successMessage, submitLabel, secondaryActions, className, children, resetOnSuccess, hideSubmit, refresh = true }: Props<T>) {
  const t = useTranslations();
  const router = useRouter();
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const formRef = React.useRef<HTMLFormElement>(null);

  const translate = (key: string) => (key.includes(".") && !key.includes(" ") ? t.has(key) ? t(key) : key : key);

  async function handle(fd: FormData) {
    const res = await action(fd);
    if (res.ok) {
      setErrors({});
      toast.success(successMessage ?? t("common.saved"));
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(res.data);
      if (refresh) router.refresh();
    } else {
      setErrors(res.fieldErrors ?? {});
      toast.error(translate(res.error));
    }
  }

  return (
    <Ctx.Provider value={errors}>
      <form ref={formRef} action={handle} className={cn("space-y-4", className)}>
        {children}
        {errors._ ? <p className="text-sm text-destructive">{errors._.join(", ")}</p> : null}
        {hideSubmit ? null : (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <SubmitButton>{submitLabel ?? t("common.save")}</SubmitButton>
            {secondaryActions}
          </div>
        )}
      </form>
    </Ctx.Provider>
  );
}

/** Convenience: error text for a field from the enclosing ActionForm. */
export function FieldError({ name }: { name: string }) {
  const errors = useFieldErrors();
  const e = errors[name];
  if (!e?.length) return null;
  return (
    <p className="text-xs text-destructive" role="alert">
      {e[0]}
    </p>
  );
}
