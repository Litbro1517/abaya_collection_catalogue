import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/lib/auth';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

/**
 * /admin — Protected admin management space
 *
 * Server-side auth check: only owner/admin roles can access.
 * Editors and unauthenticated users are redirected to /.
 */
export default async function AdminPage() {
  const admin = await getCurrentAdmin();

  // Not authenticated → redirect to home
  if (!admin) {
    redirect('/');
  }

  // Not owner/admin → redirect to home
  if (admin.role !== 'owner' && admin.role !== 'admin') {
    redirect('/');
  }

  return <AdminDashboard admin={admin} />;
}
