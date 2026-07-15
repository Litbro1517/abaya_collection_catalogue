import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/lib/auth';

/**
 * /admin/orders — Protected admin orders management route
 *
 * Server-side auth check: only owner/admin roles can access.
 * Redirects to the BuilderShell with the Orders pillar pre-selected.
 */
export default async function AdminOrdersPage() {
  const admin = await getCurrentAdmin();

  // Not authenticated → redirect to home
  if (!admin) {
    redirect('/');
  }

  // Not owner/admin/super_admin → redirect to home
  if (admin.role !== 'owner' && admin.role !== 'admin' && admin.role !== 'super_admin') {
    redirect('/');
  }

  // Redirect to the main admin dashboard with a query param that triggers
  // the Orders pillar in the BuilderShell.
  redirect('/?view=builder&pillar=orders');
}
