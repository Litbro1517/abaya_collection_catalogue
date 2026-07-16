'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingBag, Clock, CheckCircle2, Truck, DollarSign } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import type { Order } from '@/types';
import { OrdersTable } from './OrdersTable';
import { OrderDetailSheet } from './OrderDetailSheet';

const PAGE_SIZE = 10;

export function OrdersPillar() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // KPI state
  const [kpi, setKpi] = useState({ total: 0, pending: 0, delivered: 0, revenue: 0 });

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
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
  }, [page, statusFilter, search]);

  const fetchKpi = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?limit=100');
      const json = await res.json();
      if (json.data && Array.isArray(json.data)) {
        const all = json.data as Order[];
        const pending = all.filter(o => o.status === 'pending').length;
        const delivered = all.filter(o => o.status === 'delivered').length;
        // Revenue = sum of delivered orders' productPrice (parse number from formatted string)
        const revenue = all
          .filter(o => o.status === 'delivered' || o.status === 'shipped')
          .reduce((sum, o) => {
            const m = (o.productPrice || '').match(/[\d.,]+/);
            const num = m ? parseFloat(m[0].replace(/\s/g, '').replace(',', '.')) : 0;
            return sum + (isNaN(num) ? 0 : num * (o.productQuantity || 1));
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

  const handleStatusUpdated = useCallback(() => {
    fetchOrders();
    fetchKpi();
    setSheetOpen(false);
  }, [fetchOrders, fetchKpi]);

  const handleRowClick = (order: Order) => {
    setSelectedOrder(order);
    setSheetOpen(true);
  };

  const kpiCards = [
    { label: t('order.kpiTotal'), value: kpi.total, icon: ShoppingBag, color: 'text-foreground' },
    { label: t('order.kpiPending'), value: kpi.pending, icon: Clock, color: 'text-amber-600' },
    { label: t('order.kpiDelivered'), value: kpi.delivered, icon: CheckCircle2, color: 'text-green-600' },
    { label: t('order.kpiRevenue'), value: `${kpi.revenue.toFixed(0)} DH`, icon: DollarSign, color: 'text-foreground' },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{t('order.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('order.subtitle')}</p>
      </div>

      {/* KPI Cards */}
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

      {/* Orders table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t('order.listTitle')}</CardTitle>
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
            onPageChange={setPage}
            onSearchChange={(s) => { setPage(0); setSearch(s); }}
            onStatusFilterChange={(s) => { setPage(0); setStatusFilter(s); }}
            onRowClick={handleRowClick}
          />
        </CardContent>
      </Card>

      {/* Detail drawer */}
      <OrderDetailSheet
        order={selectedOrder}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onStatusUpdated={handleStatusUpdated}
      />
    </div>
  );
}
