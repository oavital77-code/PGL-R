import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/ui/page-header";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { EmployeeDashboard } from "@/components/dashboard/employee-dashboard";
import { ManagerDashboard } from "@/components/dashboard/manager-dashboard";

export default async function DashboardPage() {
  const user = await requireUser();
  const t = await getTranslations("dashboard");
  return (
    <>
      <PageHeader title={t("title")} description={t("welcome", { name: user.firstName })} />
      {user.role === "admin" ? <AdminDashboard user={user} /> : user.role === "manager" ? <ManagerDashboard user={user} /> : <EmployeeDashboard user={user} />}
    </>
  );
}
