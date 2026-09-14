import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenerSesion as getSession } from "@/lib/auth";
import { getAdminStats, getAllOrders, getProducts } from "@/lib/data";
import AdminDashboard from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Panel de administración",
  robots: { index: false },
};

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (session.role !== "admin") redirect("/");

  const [stats, products, orders] = await Promise.all([
    getAdminStats(),
    getProducts(),
    getAllOrders(),
  ]);

  return (
    <AdminDashboard
      stats={stats}
      initialProducts={products}
      initialOrders={orders}
      adminName={session.name}
    />
  );
}
