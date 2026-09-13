import { getTranslations } from "next-intl/server";
import { CAPABILITY_GROUPS, LOCKED_CAPABILITIES, roleCapabilities } from "@/lib/auth/capabilities";
import { getSetting } from "@/lib/settings/service";
import { SettingsForm } from "../settings-form";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/form-field";
import { Lock } from "lucide-react";

export async function PermissionsStep() {
  const [p, t, tc, tr] = await Promise.all([getSetting("permissions"), getTranslations("settings.permissions"), getTranslations("capabilities"), getTranslations("roles")]);
  const manager = roleCapabilities("manager", p);
  const employee = roleCapabilities("employee", p);
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="mb-3 text-sm text-muted-foreground">{t("intro")}</p>
        <SettingsForm settingKey="permissions" step="permissions">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("capability")}</TableHead>
                <TableHead className="text-center">{tr("admin")}</TableHead>
                <TableHead className="text-center">{tr("manager")}</TableHead>
                <TableHead className="text-center">{tr("employee")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CAPABILITY_GROUPS.map((g) => (
                <React.Fragment key={g.group}>
                  <TableRow className="bg-muted/40">
                    <TableCell colSpan={4} className="font-semibold">
                      {t(`groups.${g.group}`)}
                    </TableCell>
                  </TableRow>
                  {g.caps.map((cap) => {
                    const locked = LOCKED_CAPABILITIES.has(cap);
                    return (
                      <TableRow key={cap}>
                        <TableCell>
                          <input type="hidden" name="$caps" value={cap} />
                          <span>{tc(cap)}</span> <span className="ms-1 text-xs text-muted-foreground num">{cap}</span>
                          {locked ? <Lock className="ms-2 inline h-3 w-3 text-muted-foreground" aria-label={t("locked")} /> : null}
                        </TableCell>
                        <TableCell className="text-center">✔</TableCell>
                        <TableCell className="text-center">{locked ? "✖" : <input type="checkbox" name={`manager.${cap}`} defaultChecked={manager.has(cap)} />}</TableCell>
                        <TableCell className="text-center">{locked ? "✖" : <input type="checkbox" name={`employee.${cap}`} defaultChecked={employee.has(cap)} />}</TableCell>
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={`${t("others_scope")} – ${tr("manager")}`} htmlFor="os-m">
              <Select id="os-m" name="others_scope.manager" defaultValue={p.others_scope.manager}>
                <option value="all">{t("scope_all")}</option>
                <option value="department">{t("scope_department")}</option>
              </Select>
            </Field>
            <Field label={`${t("others_scope")} – ${tr("employee")}`} htmlFor="os-e">
              <Select id="os-e" name="others_scope.employee" defaultValue={p.others_scope.employee}>
                <option value="all">{t("scope_all")}</option>
                <option value="department">{t("scope_department")}</option>
              </Select>
            </Field>
          </div>
        </SettingsForm>
      </CardContent>
    </Card>
  );
}
import * as React from "react";
