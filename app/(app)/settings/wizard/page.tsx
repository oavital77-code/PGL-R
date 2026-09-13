import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { WIZARD_STEPS } from "@/lib/settings/defaults";
import { getSetting } from "@/lib/settings/service";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FinishWizardButton } from "@/components/settings/finish-wizard-button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default async function WizardPage() {
  const [ob, t, ts] = await Promise.all([getSetting("onboarding"), getTranslations("settings.wizard"), getTranslations("settings.steps")]);
  const requiredDone = WIZARD_STEPS.filter((s) => s.required).every((s) => ob.completed_steps.includes(s.key));
  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      {ob.completed ? (
        <Alert variant="success" className="mb-4">
          <AlertDescription>{t("completed")}</AlertDescription>
        </Alert>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>{ts("company").length ? "" : ""}</TableHead>
            <TableHead>{t("required")}</TableHead>
            <TableHead>{t("done")}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {WIZARD_STEPS.map((s, i) => {
            const done = ob.completed_steps.includes(s.key);
            return (
              <TableRow key={s.key}>
                <TableCell className="num">{i + 1}</TableCell>
                <TableCell className="font-medium">{ts(s.key)}</TableCell>
                <TableCell>{s.required ? <Badge variant="warning">{t("required")}</Badge> : <Badge variant="muted">{t("optional")}</Badge>}</TableCell>
                <TableCell>{done ? <Badge variant="success">{t("done")}</Badge> : <Badge variant="outline">{t("pending")}</Badge>}</TableCell>
                <TableCell className="text-end">
                  <Button asChild size="sm" variant={done ? "outline" : "default"}>
                    <Link href={s.path}>{ts(s.key)}</Link>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {!ob.completed ? (
        <div className="mt-5 flex items-center gap-3">
          <FinishWizardButton disabled={!requiredDone} />
          <span className="text-sm text-muted-foreground">{requiredDone ? t("finish_hint") : t("finish_blocked")}</span>
        </div>
      ) : null}
    </>
  );
}
