import { getCurrentAdmin } from '@/lib/auth';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminLoginPage } from '@/components/admin/AdminLoginPage';

/**
 * /admin — Protected admin management space
 *
 * VG41.2: Unauthenticated users now see the admin login page instead of
 * being redirected to /. This allows direct access to /admin for login.
 * Only owner/admin/super_admin roles can access the dashboard.
 */
export default async function AdminPage() {
  const admin = await getCurrentAdmin();

  // Not authenticated → show login page (was redirect('/') before VG41.2)
  if (!admin) {
    return <AdminLoginPage />;
  }

  // Not owner/admin/super_admin → show login page with error
  if (admin.role !== 'owner' && admin.role !== 'admin' && admin.role !== 'super_admin') {
    return <AdminLoginPage error="Accès refusé. Rôle insuffisant." />;
  }

  return <AdminDashboard admin={admin} />;
}
