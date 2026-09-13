import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { WIZARD_STEPS, type WizardStepKey } from "@/lib/settings/defaults";
import { getSetting } from "@/lib/settings/service";
import { PageHeader } from "@/components/ui/page-header";
import { MarkDoneButton } from "@/components/settings/mark-done-button";
import { CompanyStep } from "@/components/settings/steps/company";
import { EmailStep } from "@/components/settings/steps/email";
import { DepartmentsStep } from "@/components/settings/steps/departments";
import { RatesStep } from "@/components/settings/steps/rates";
import { VatStep } from "@/components/settings/steps/vat";
import { IndexStep } from "@/components/settings/steps/index-step";
import { NumberingStep } from "@/components/settings/steps/numbering";
import { StagesStep } from "@/components/settings/steps/stages";
import { LookupsStep } from "@/components/settings/steps/lookups";
import { HoursStep } from "@/components/settings/steps/hours";
import { PermissionsStep } from "@/components/settings/steps/permissions";
import { SignaturesStep } from "@/components/settings/steps/signatures";
import { InvoicesStep } from "@/components/settings/steps/invoices";
import { SuppliersStep } from "@/components/settings/steps/suppliers";
import { AccountingStep } from "@/components/settings/steps/accounting";
import { SecurityStep } from "@/components/settings/steps/security";
import { NotificationsStep } from "@/components/settings/steps/notifications";

const STEPS: Record<string, React.ComponentType> = {
  company: CompanyStep,
  email: EmailStep,
  departments: DepartmentsStep,
  rates: RatesStep,
  vat: VatStep,
  index: IndexStep,
  numbering: NumberingStep,
  stages: StagesStep,
  lookups: LookupsStep,
  hours: HoursStep,
  permissions: PermissionsStep,
  signatures: SignaturesStep,
  invoices: InvoicesStep,
  suppliers: SuppliersStep,
  accounting: AccountingStep,
  security: SecurityStep,
  notifications: NotificationsStep,
};

/** Steps whose content is a table (not a single form) get an explicit "mark done" button. */
const TABLE_STEPS = new Set(["departments", "rates", "vat", "stages", "lookups", "signatures"]);

export default async function SettingsStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const Comp = STEPS[step];
  if (!Comp) notFound();
  const [ob, ts] = await Promise.all([getSetting("onboarding"), getTranslations("settings.steps")]);
  const isWizardStep = WIZARD_STEPS.some((s) => s.key === step);
  const done = ob.completed_steps.includes(step);
  return (
    <>
      <PageHeader title={ts(step)} actions={isWizardStep && TABLE_STEPS.has(step) ? <MarkDoneButton step={step as WizardStepKey} done={done} /> : undefined} />
      <Comp />
    </>
  );
}
