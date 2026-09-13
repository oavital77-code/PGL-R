import { getTranslations } from "next-intl/server";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { getSetting } from "@/lib/settings/service";
import { SettingsForm } from "../settings-form";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export async function NotificationsStep() {
  const [s, t, te] = await Promise.all([getSetting("notifications"), getTranslations("settings.notifications"), getTranslations("notification_events")]);
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="mb-3 text-sm text-muted-foreground">{t("intro")}</p>
        <SettingsForm settingKey="notifications" step={null}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("event")}</TableHead>
                <TableHead className="text-center">{t("in_app")}</TableHead>
                <TableHead className="text-center">{t("email")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {NOTIFICATION_EVENTS.map((ev) => {
                const cur = s.channels[ev.type] ?? { in_app: ev.in_app, email: ev.email };
                return (
                  <TableRow key={ev.type}>
                    <TableCell>
                      <input type="hidden" name="$events" value={ev.type} />
                      {te(ev.type)}
                    </TableCell>
                    <TableCell className="text-center">
                      <input type="checkbox" name={`${ev.type}.in_app`} defaultChecked={cur.in_app} />
                    </TableCell>
                    <TableCell className="text-center">
                      <input type="checkbox" name={`${ev.type}.email`} defaultChecked={cur.email} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </SettingsForm>
      </CardContent>
    </Card>
  );
}
