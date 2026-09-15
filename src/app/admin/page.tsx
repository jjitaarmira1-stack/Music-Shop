import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenerSesion as getSession } from "@/lib/auth";
import {
  getAdminCharts,
  getAdminStats,
  getAllOrders,
  getProducts,
} from "@/lib/data";
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

  // Las cuatro consultas van en paralelo: el panel tarda lo que la
  // más lenta, no la suma de todas.
  const [stats, charts, products, orders] = await Promise.all([
    getAdminStats(),
    getAdminCharts(), // Series y desgloses para las gráficas.
    getProducts(),
    getAllOrders(),
  ]);

  return (
    <AdminDashboard
      stats={stats}
      charts={charts}
      initialProducts={products}
      initialOrders={orders}
      adminName={session.name}
      adminEmail={session.email}
    />
  );
}
