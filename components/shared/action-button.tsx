"use client";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions/result";
import { Button, type ButtonProps } from "@/components/ui/button";

interface Props<T> extends Omit<ButtonProps, "onClick"> {
  action: () => Promise<ActionResult<T>>;
  confirm?: string;
  successMessage?: string;
  onSuccess?: (data: T) => void;
  refresh?: boolean;
}

/** Button that runs a server action with optional confirm + toast. */
export function ActionButton<T>({ action, confirm, successMessage, onSuccess, refresh = true, children, ...props }: Props<T>) {
  const t = useTranslations();
  const router = useRouter();
  const [pending, start] = React.useTransition();
  return (
    <Button
      {...props}
      disabled={pending || props.disabled}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const res = await action();
          if (res.ok) {
            toast.success(successMessage ?? t("common.saved"));
            onSuccess?.(res.data);
            if (refresh) router.refresh();
          } else toast.error(t.has(res.error) ? t(res.error) : res.error);
        });
      }}
    >
      {pending ? <Loader2 className="animate-spin" /> : null}
      {children}
    </Button>
  );
}
