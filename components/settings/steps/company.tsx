import { getTranslations } from "next-intl/server";
import { getSetting } from "@/lib/settings/service";
import { SettingsForm } from "../settings-form";
import { Field } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyAssetUpload } from "../company-asset-upload";

export async function CompanyStep() {
  const [c, t] = await Promise.all([getSetting("company"), getTranslations("settings.company")]);
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardContent className="pt-5">
          <SettingsForm settingKey="company" step="company">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t("name")} htmlFor="name" required>
                <Input id="name" name="name" defaultValue={c.name} required />
              </Field>
              <Field label={t("tax_id")} htmlFor="tax_id" required>
                <Input id="tax_id" name="tax_id" defaultValue={c.tax_id} required className="num" />
              </Field>
              <Field label={t("address")} htmlFor="address" className="md:col-span-2">
                <Input id="address" name="address" defaultValue={c.address} />
              </Field>
              <Field label={t("phone")} htmlFor="phone">
                <Input id="phone" name="phone" type="tel" defaultValue={c.phone} />
              </Field>
              <Field label={t("fax")} htmlFor="fax">
                <Input id="fax" name="fax" type="tel" defaultValue={c.fax} />
              </Field>
              <Field label={t("website")} htmlFor="website">
                <Input id="website" name="website" type="url" defaultValue={c.website} />
              </Field>
              <Field label={t("email")} htmlFor="email">
                <Input id="email" name="email" type="email" defaultValue={c.email} />
              </Field>
            </div>
            <h3 className="mt-4 font-semibold">{t("bank")}</h3>
            <div className="grid gap-4 md:grid-cols-4">
              <Field label={t("bank_name")} htmlFor="bank.bank">
                <Input id="bank.bank" name="bank.bank" defaultValue={c.bank.bank} />
              </Field>
              <Field label={t("bank_branch")} htmlFor="bank.branch">
                <Input id="bank.branch" name="bank.branch" defaultValue={c.bank.branch} className="num" />
              </Field>
              <Field label={t("bank_account")} htmlFor="bank.account">
                <Input id="bank.account" name="bank.account" defaultValue={c.bank.account} className="num" />
              </Field>
              <Field label={t("bank_beneficiary")} htmlFor="bank.beneficiary">
                <Input id="bank.beneficiary" name="bank.beneficiary" defaultValue={c.bank.beneficiary} />
              </Field>
            </div>
            <Field label={t("pdf_footer_text")} htmlFor="pdf_footer_text">
              <Textarea id="pdf_footer_text" name="pdf_footer_text" defaultValue={c.pdf_footer_text} rows={2} />
            </Field>
          </SettingsForm>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("logo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {c.logo_document_id ? <img src={`/api/files/${c.logo_document_id}?inline=1`} alt={t("current_logo")} className="max-h-24 object-contain" /> : null}
            <CompanyAssetUpload kind="logo" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("iso_badge")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {c.iso_badge_document_id ? <img src={`/api/files/${c.iso_badge_document_id}?inline=1`} alt="ISO" className="max-h-24 object-contain" /> : null}
            <CompanyAssetUpload kind="iso_badge" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
