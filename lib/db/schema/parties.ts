import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { baseColumns, softDeleteColumns } from "./_common";
import { clientKindEnum } from "./enums";

export const clients = pgTable(
  "clients",
  {
    ...baseColumns,
    ...softDeleteColumns,
    name: text("name").notNull(),
    taxId: text("tax_id"),
    clientKind: clientKindEnum("client_kind").notNull().default("company"),
    addressStreet: text("address_street"),
    addressCity: text("address_city"),
    addressZip: text("address_zip"),
    phone: text("phone"),
    email: text("email"),
    website: text("website"),
    paymentTermsDays: integer("payment_terms_days"),
    indexLinkedDefault: boolean("index_linked_default"),
    vatExempt: boolean("vat_exempt").notNull().default(false),
    withholdingTaxPct: numeric("withholding_tax_pct", { precision: 5, scale: 2 }),
    withholdingValidUntil: date("withholding_valid_until"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("clients_name_idx").on(t.name)],
);

export const suppliers = pgTable(
  "suppliers",
  {
    ...baseColumns,
    ...softDeleteColumns,
    name: text("name").notNull(),
    taxId: text("tax_id"),
    field: text("field"),
    addressStreet: text("address_street"),
    addressCity: text("address_city"),
    addressZip: text("address_zip"),
    phone: text("phone"),
    email: text("email"),
    website: text("website"),
    paymentTermsDays: integer("payment_terms_days"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("suppliers_name_idx").on(t.name)],
);

export const contacts = pgTable(
  "contacts",
  {
    ...baseColumns,
    ...softDeleteColumns,
    clientId: uuid("client_id").references(() => clients.id),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    roleTitle: text("role_title"),
    email: text("email"),
    phone: text("phone"),
    receivesInvoices: boolean("receives_invoices").notNull().default(false),
    isPrimary: boolean("is_primary").notNull().default(false),
  },
  (t) => [
    index("contacts_client_idx").on(t.clientId),
    index("contacts_supplier_idx").on(t.supplierId),
    check("contacts_exactly_one_owner", sql`(${t.clientId} is not null)::int + (${t.supplierId} is not null)::int = 1`),
  ],
);
