'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  ShoppingBag, Clock, CheckCircle2, DollarSign,
  Archive, RotateCcw, Trash2, Download,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { toast } from 'sonner';
import type { Order } from '@/types';
import { OrdersTable } from './OrdersTable';
import { OrderDetailSheet } from './OrderDetailSheet';

const PAGE_SIZE = 10;
const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

export function OrdersPillar() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [purgeConfirmed, setPurgeConfirmed] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // KPI state
  const [kpi, setKpi] = useState({ total: 0, pending: 0, delivered: 0, revenue: 0 });

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
        archived: view === 'archived' ? 'true' : 'false',
      });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search) params.set('search', search);

      const res = await fetch(`/api/orders?${params.toString()}`);
      const json = await res.json();
      if (json.data) {
        setOrders(json.data);
        setTotal(json.total || 0);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, view]);

  const fetchKpi = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?limit=100&archived=false');
      const json = await res.json();
      if (json.data && Array.isArray(json.data)) {
        const all = json.data as Order[];
        const pending = all.filter(o => o.status === 'pending').length;
        const delivered = all.filter(o => o.status === 'delivered').length;
        const revenue = all
          .filter(o => o.status === 'delivered' || o.status === 'shipped')
          .reduce((sum, o) => {
            const m = (o.productPrice || '').match(/[\d.,]+/);
            const num = m ? parseFloat(m[0].replace(/\s/g, '').replace(',', '.')) : 0;
            return sum + (isNaN(num) ? 0 : num);
          }, 0);
        setKpi({ total: json.total || all.length, pending, delivered, revenue });
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    fetchKpi();
  }, [fetchKpi]);

  // Reset selection when view/page changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [view, page]);

  const handleCellUpdated = useCallback(() => {
    fetchOrders();
    fetchKpi();
  }, [fetchOrders, fetchKpi]);

  const handleRowClick = (order: Order) => {
    setSelectedOrder(order);
    setSheetOpen(true);
  };

  // Archive selected orders
  const handleArchive = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/orders/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
        return;
      }
      toast.success(t('adminOrder.archiveSuccess'));
      setSelectedIds(new Set());
      fetchOrders();
      fetchKpi();
    } catch {
      toast.error('Error');
    } finally {
      setActionLoading(false);
    }
  };

  // Restore selected archived orders
  const handleRestore = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/orders/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
        return;
      }
      toast.success(t('adminOrder.restoreSuccess'));
      setSelectedIds(new Set());
      fetchOrders();
    } catch {
      toast.error('Error');
    } finally {
      setActionLoading(false);
    }
  };

  // Purge selected archived orders (permanent)
  const handlePurge = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/orders/purge', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const json = await res.json();
      if (json.error) {
        toast.error(json.error);
        return;
      }
      toast.success(t('adminOrder.purgeSuccess'));
      setSelectedIds(new Set());
      setPurgeDialogOpen(false);
      setPurgeConfirmed(false);
      fetchOrders();
    } catch {
      toast.error('Error');
    } finally {
      setActionLoading(false);
    }
  };

  // Export CSV (current view)
  const handleExport = async () => {
    try {
      const res = await fetch(`/api/orders/export?view=${view}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = view === 'archived' ? 'commandes-archives.csv' : 'commandes-actives.csv';
        a.click();
        URL.revokeObjectURL(url);
        toast.success(t('adminOrder.exportSuccess'));
      } else {
        toast.error(t('adminOrder.exportError'));
      }
    } catch {
      toast.error(t('adminOrder.exportError'));
    }
  };

  // Purge eligibility: archived > 10 days
  const isPurgeEligible = (order: Order) => {
    if (!order.deletedAt) return false;
    return new Date(order.deletedAt).getTime() < Date.now() - TEN_DAYS_MS;
  };

  const purgeEligibleCount = view === 'archived'
    ? Array.from(selectedIds).filter(id => {
        const o = orders.find(o => o.id === id);
        return o && isPurgeEligible(o);
      }).length
    : 0;

  const kpiCards = [
    { label: t('adminOrder.kpiTotal'), value: kpi.total, icon: ShoppingBag, color: 'text-foreground' },
    { label: t('adminOrder.kpiPending'), value: kpi.pending, icon: Clock, color: 'text-amber-600' },
    { label: t('adminOrder.kpiDelivered'), value: kpi.delivered, icon: CheckCircle2, color: 'text-green-600' },
    { label: t('adminOrder.kpiRevenue'), value: `${kpi.revenue.toFixed(0)} DH`, icon: DollarSign, color: 'text-foreground' },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{t('adminOrder.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('adminOrder.subtitle')}</p>
      </div>

      {/* KPI Cards — only in active view */}
      {view === 'active' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpiCards.map((k, i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{k.label}</p>
                    {loading ? (
                      <Skeleton className="h-6 w-16" />
                    ) : (
                      <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                    )}
                  </div>
                  <k.icon className="w-5 h-5 text-muted-foreground/60" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Orders table + action bar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{t('adminOrder.listTitle')}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="h-8 text-xs gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              {t('adminOrder.exportCsv')}
            </Button>
          </div>

          {/* Selection action bar */}
          {selectedIds.size > 0 && (
            <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-muted/50 border text-xs">
              <span className="font-medium">
                {t('adminOrder.selected').replace('{count}', String(selectedIds.size))}
              </span>
              <div className="flex-1" />
              {view === 'active' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleArchive}
                  disabled={actionLoading}
                  className="h-7 text-xs gap-1.5"
                >
                  <Archive className="w-3.5 h-3.5" />
                  {t('adminOrder.archive')}
                </Button>
              )}
              {view === 'archived' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRestore}
                    disabled={actionLoading}
                    className="h-7 text-xs gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {t('adminOrder.restore')}
                  </Button>
                  <AlertDialog open={purgeDialogOpen} onOpenChange={(open) => { setPurgeDialogOpen(open); if (!open) setPurgeConfirmed(false); }}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={actionLoading || purgeEligibleCount === 0}
                        className="h-7 text-xs gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('adminOrder.purge')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('adminOrder.purgeConfirm')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('adminOrder.purgeWarning')} ({purgeEligibleCount} commande(s))
                          <label className="flex items-center gap-2 mt-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={purgeConfirmed}
                              onChange={e => setPurgeConfirmed(e.target.checked)}
                              className="rounded"
                            />
                            {t('adminOrder.confirmPurge')}
                          </label>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('adminOrder.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handlePurge}
                          disabled={!purgeConfirmed || actionLoading}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {t('adminOrder.purge')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          )}

          {/* Purge eligibility hint */}
          {view === 'archived' && (
            <p className="mt-2 text-[11px] text-muted-foreground italic">
              {t('adminOrder.purgeHint')}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <OrdersTable
            orders={orders}
            total={total}
            loading={loading}
            page={page}
            pageSize={PAGE_SIZE}
            search={search}
            statusFilter={statusFilter}
            view={view}
            selectedIds={selectedIds}
            onPageChange={setPage}
            onSearchChange={(s) => { setPage(0); setSearch(s); }}
            onStatusFilterChange={(s) => { setPage(0); setStatusFilter(s); }}
            onViewChange={(v) => { setPage(0); setView(v); }}
            onRowClick={handleRowClick}
            onSelectionChange={setSelectedIds}
            onCellUpdated={handleCellUpdated}
          />
        </CardContent>
      </Card>

      {/* Detail drawer */}
      <OrderDetailSheet
        order={selectedOrder}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onStatusUpdated={handleCellUpdated}
      />
    </div>
  );
}
