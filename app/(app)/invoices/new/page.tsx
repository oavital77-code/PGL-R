import { getTranslations } from "next-intl/server";
import { requireCapability } from "@/lib/auth/authorize";
import { invoiceableContracts } from "@/lib/invoices/queries";
import { todayLocal } from "@/lib/i18n/format";
import { PageHeader } from "@/components/ui/page-header";
import { NewInvoiceWizard } from "@/components/invoices/new-wizard";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ q?: string; contract?: string }> }) {
  await requireCapability("invoices.create");
  const sp = await searchParams;
  const [contracts, t] = await Promise.all([invoiceableContracts(sp.q), getTranslations("invoices.wizard")]);
  const today = todayLocal();
  const prevMonthStart = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1)).toISOString().slice(0, 10);
  const prevMonthEnd = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 0)).toISOString().slice(0, 10);
  return (
    <>
      <PageHeader title={t("title")} />
      <NewInvoiceWizard contracts={contracts} initialQuery={sp.q ?? ""} preselect={sp.contract} today={today} defaultPeriod={{ from: prevMonthStart, to: prevMonthEnd }} />
    </>
  );
}
