import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { can, requireCapability } from "@/lib/auth/authorize";
import { db } from "@/lib/db";
import { contacts, contracts, projects, supplierInvoices, suppliers } from "@/lib/db/schema";
import { formatDate, formatMoney, formatPct } from "@/lib/i18n/format";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { SupplierDialog } from "@/components/suppliers/supplier-form";
import { ContactsPanel } from "@/components/clients/contacts-panel";
import { DocumentsPanel } from "@/components/shared/documents-panel";
import { supplierFields } from "@/lib/suppliers/queries";

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCapability("suppliers.view");
  const { id } = await params;
  const [supplier] = await db.select().from(suppliers).where(and(eq(suppliers.id, id), isNull(suppliers.deletedAt)));
  if (!supplier) notFound();
  const [ctcs, cons, invs, fields, t, tc, ts] = await Promise.all([
    db.select().from(contacts).where(and(eq(contacts.supplierId, id), isNull(contacts.deletedAt))).orderBy(desc(contacts.isPrimary)),
    db
      .select({ c: contracts, workNumber: projects.workNumber, projectName: projects.name, projectId: projects.id })
      .from(contracts)
      .innerJoin(projects, eq(projects.id, contracts.projectId))
      .where(and(eq(contracts.supplierId, id), isNull(contracts.deletedAt)))
      .orderBy(desc(contracts.createdAt)),
    db
      .select({ i: supplierInvoices, contractName: contracts.name, workNumber: projects.workNumber })
      .from(supplierInvoices)
      .innerJoin(contracts, eq(contracts.id, supplierInvoices.contractId))
      .innerJoin(projects, eq(projects.id, contracts.projectId))
      .where(and(eq(contracts.supplierId, id), isNull(supplierInvoices.deletedAt)))
      .orderBy(desc(supplierInvoices.invoiceDate)),
    supplierFields(),
    getTranslations("suppliers"),
    getTranslations("common"),
    getTranslations("supplier_invoices.status"),
  ]);
  const canEdit = can(user, "suppliers.edit");
  const budget = cons.reduce((a, c) => a + Number(c.c.budgetAmount ?? 0), 0);
  const approved = invs.filter((r) => r.i.status === "approved" || r.i.status === "paid").reduce((a, r) => a + Number(r.i.amountBeforeVat), 0);
  const paid = invs.filter((r) => r.i.status === "paid").reduce((a, r) => a + Number(r.i.amountBeforeVat), 0);
  return (
    <>
      <PageHeader title={supplier.name} description={supplier.field ?? undefined} actions={canEdit ? <SupplierDialog supplier={supplier} fields={fields} /> : undefined} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("budget")} value={formatMoney(budget)} />
        <Stat label={t("approved")} value={formatMoney(approved)} />
        <Stat label={t("paid")} value={formatMoney(paid)} />
        <Stat label={t("balance")} value={formatMoney(budget - approved)} tone={budget - approved < 0 ? "destructive" : "default"} />
      </div>
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">{t("tab_details")}</TabsTrigger>
          <TabsTrigger value="contacts">{t("tab_contacts")}</TabsTrigger>
          <TabsTrigger value="contracts">{t("tab_contracts")}</TabsTrigger>
          <TabsTrigger value="invoices">{t("tab_invoices")}</TabsTrigger>
          <TabsTrigger value="documents">{t("tab_documents")}</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <dl className="grid gap-x-8 gap-y-2 rounded-lg border border-border bg-card p-5 text-sm md:grid-cols-2">
            <div className="flex gap-2"><dt className="w-40 text-muted-foreground">{t("tax_id")}</dt><dd className="num">{supplier.taxId ?? "—"}</dd></div>
            <div className="flex gap-2"><dt className="w-40 text-muted-foreground">{t("address_street")}</dt><dd>{[supplier.addressStreet, supplier.addressCity].filter(Boolean).join(", ") || "—"}</dd></div>
            <div className="flex gap-2"><dt className="w-40 text-muted-foreground">{tc("phone")}</dt><dd className="num">{supplier.phone ?? "—"}</dd></div>
            <div className="flex gap-2"><dt className="w-40 text-muted-foreground">{tc("email")}</dt><dd className="num">{supplier.email ?? "—"}</dd></div>
            <div className="flex gap-2"><dt className="w-40 text-muted-foreground">{t("payment_terms_days")}</dt><dd className="num">{supplier.paymentTermsDays ?? "—"}</dd></div>
            <div className="flex gap-2"><dt className="w-40 text-muted-foreground">{tc("notes")}</dt><dd>{supplier.notes ?? "—"}</dd></div>
          </dl>
        </TabsContent>
        <TabsContent value="contacts">
          <ContactsPanel owner={{ supplierId: id }} rows={ctcs} canEdit={canEdit} showInvoiceFlag={false} />
        </TabsContent>
        <TabsContent value="contracts">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("project")}</TableHead>
                <TableHead>{t("contract")}</TableHead>
                <TableHead>{t("budget")}</TableHead>
                <TableHead>{t("signed_date")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {tc("none")}
                  </TableCell>
                </TableRow>
              ) : (
                cons.map((r) => (
                  <TableRow key={r.c.id}>
                    <TableCell>
                      <Link href={`/projects/${r.projectId}`} className="text-primary hover:underline">
                        <span className="num">{r.workNumber}</span> – {r.projectName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/contracts/${r.c.id}`} className="text-primary hover:underline">
                        {r.c.numberInProject}. {r.c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="num-cell">{formatMoney(r.c.budgetAmount)}</TableCell>
                    <TableCell className="num-cell">{formatDate(r.c.signedDate)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
        <TabsContent value="invoices">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("invoice_number")}</TableHead>
                <TableHead>{t("project")}</TableHead>
                <TableHead>{tc("date")}</TableHead>
                <TableHead>{t("before_vat")}</TableHead>
                <TableHead>{t("progress_claimed")}</TableHead>
                <TableHead>{tc("status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    {tc("none")}
                  </TableCell>
                </TableRow>
              ) : (
                invs.map((r) => (
                  <TableRow key={r.i.id}>
                    <TableCell className="num-cell">
                      <Link href={`/supplier-invoices/${r.i.id}`} className="text-primary hover:underline">
                        {r.i.supplierInvoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="num">{r.workNumber}</span> – {r.contractName}
                    </TableCell>
                    <TableCell className="num-cell">{formatDate(r.i.invoiceDate)}</TableCell>
                    <TableCell className="num-cell">{formatMoney(r.i.amountBeforeVat)}</TableCell>
                    <TableCell className="num-cell">{formatPct(r.i.progressPctClaimed)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{ts(r.i.status)}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsPanel entityType="supplier" entityId={id} canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </>
  );
}
