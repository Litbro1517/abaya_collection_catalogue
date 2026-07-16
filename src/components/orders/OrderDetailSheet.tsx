'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Loader2, Phone, MapPin, Package, Calendar, RotateCcw, History } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { format } from 'date-fns';
import { fr, enUS, ar } from 'date-fns/locale';
import type { Order, OrderHistoryEntry } from '@/types';
import { ORDER_STATUSES } from '@/types';
import { OrderStatusBadge } from './OrderStatusBadge';

interface OrderDetailSheetProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusUpdated: () => void;
}

export function OrderDetailSheet({ order, open, onOpenChange, onStatusUpdated }: OrderDetailSheetProps) {
  const { t, locale } = useTranslation();
  const [updating, setUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [history, setHistory] = useState<OrderHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const dateLocale = locale === 'ar' ? ar : locale === 'en' ? enUS : fr;

  useEffect(() => {
    if (order) {
      setSelectedStatus(order.status);
    }
  }, [order]);

  // Fetch history when order changes
  const fetchHistory = useCallback(async () => {
    if (!order) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/history`);
      const json = await res.json();
      if (json.data) {
        setHistory(json.data);
      }
    } catch {
      // silent
    } finally {
      setHistoryLoading(false);
    }
  }, [order]);

  useEffect(() => {
    if (open && order) {
      fetchHistory();
    }
  }, [open, order, fetchHistory]);

  if (!order) return null;

  const handleStatusUpdate = async () => {
    if (!order || selectedStatus === order.status) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: selectedStatus }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error || t('adminOrder.updateError'));
        return;
      }
      toast.success(t('adminOrder.updateSuccess'));
      onStatusUpdated();
      fetchHistory();
    } catch {
      toast.error(t('adminOrder.updateError'));
    } finally {
      setUpdating(false);
    }
  };

  // Restore a field value from history
  const handleRestore = async (historyId: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/history/${historyId}`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error || t('adminOrder.updateError'));
        return;
      }
      toast.success(t('adminOrder.restoreValueSuccess'));
      onStatusUpdated();
      fetchHistory();
    } catch {
      toast.error(t('adminOrder.updateError'));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between pr-8">
            <SheetTitle className="text-lg">
              {t('adminOrder.orderNumber')}
            </SheetTitle>
            <OrderStatusBadge status={order.status} label={t(`adminOrder.status_${order.status}` as never)} />
          </div>
          <SheetDescription className="font-mono text-xs">
            {order.id}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-5">
          {/* Date */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>{format(new Date(order.createdAt), 'PPP à HH:mm', { locale: dateLocale })}</span>
          </div>

          {/* Customer info */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{t('adminOrder.customerInfo')}</h3>
            <div className="rounded-lg border p-3 space-y-2 text-sm bg-muted/30">
              <div className="font-medium">{order.customerName}</div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-3.5 h-3.5" />
                <a href={`tel:${order.customerPhone}`} className="hover:underline" dir="ltr">
                  {order.customerPhone}
                </a>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  {order.customerAddress}<br />
                  {order.customerCity}
                </span>
              </div>
            </div>
          </section>

          {/* Product info */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{t('adminOrder.productInfo')}</h3>
            <div className="rounded-lg border p-3 space-y-3 text-sm bg-muted/30">
              {order.productImage && (
                <img
                  src={order.productImage}
                  alt={order.productName || ''}
                  className="w-full h-32 object-cover rounded-md"
                />
              )}
              <div className="font-medium">{order.productName || '—'}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">{t('adminOrder.color')}</span>
                  <div className="font-medium">{order.productColor || '—'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('adminOrder.size')}</span>
                  <div className="font-medium">{order.productSize || '—'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('adminOrder.quantity')}</span>
                  <div className="font-medium">{order.productQuantity}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('adminOrder.price')}</span>
                  <div className="font-medium">{order.productPrice || '—'}</div>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* Status update */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Package className="w-4 h-4" />
              {t('adminOrder.updateStatus')}
            </h3>
            <div className="flex gap-2">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>
                      {t(`adminOrder.status_${s}` as never) || s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleStatusUpdate}
                disabled={updating || selectedStatus === order.status}
                size="sm"
              >
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : t('adminOrder.save')}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t('adminOrder.updateHint')}
            </p>
          </section>

          <Separator />

          {/* Modification history — diff rouge/vert + restore */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <History className="w-4 h-4" />
              {t('adminOrder.historyTitle')}
            </h3>
            {historyLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {t('adminOrder.historyTitle')}...
              </div>
            ) : history.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">—</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {history.map(entry => (
                  <div
                    key={entry.id}
                    className="rounded-lg border p-2.5 text-xs bg-muted/20 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{entry.field}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(entry.changedAt), 'dd MMM yyyy HH:mm', { locale: dateLocale })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-red-600 line-through opacity-70">
                        {entry.oldValue || '—'}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-green-700 font-medium">
                        {entry.newValue || '—'}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRestore(entry.id)}
                      disabled={updating}
                      className="h-6 text-[11px] gap-1 px-2"
                    >
                      <RotateCcw className="w-3 h-3" />
                      {t('adminOrder.restoreValue')}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
