import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/auth/authorize";
import { MyApprovals } from "@/components/dashboard/my-approvals";
import { MyProjects } from "@/components/dashboard/my-projects";
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
      <div className="mb-5 grid gap-5 empty:hidden lg:grid-cols-2">
        <MyApprovals userId={user.id} always={can(user, "invoices.approve")} />
        <MyProjects userId={user.id} />
      </div>
      {user.role === "admin" ? <AdminDashboard user={user} /> : user.role === "manager" ? <ManagerDashboard user={user} /> : <EmployeeDashboard user={user} />}
    </>
  );
}
