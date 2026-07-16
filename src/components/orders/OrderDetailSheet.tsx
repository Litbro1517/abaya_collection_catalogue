'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Phone, MapPin, Package, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/lib/i18n';
import { format } from 'date-fns';
import { fr, enUS, ar } from 'date-fns/locale';
import type { Order, OrderStatus } from '@/types';
import { ORDER_STATUSES } from '@/types';
import { OrderStatusBadge, getStatusConfig } from './OrderStatusBadge';

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

  useEffect(() => {
    if (order) {
      setSelectedStatus(order.status);
    }
  }, [order]);

  if (!order) return null;

  const dateLocale = locale === 'ar' ? ar : locale === 'en' ? enUS : fr;
  const config = getStatusConfig(order.status);

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
        toast.error(json.error || t('order.updateError'));
        return;
      }
      toast.success(t('order.updateSuccess'));
      onStatusUpdated();
    } catch {
      toast.error(t('order.updateError'));
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
              {t('order.orderNumber')}
            </SheetTitle>
            <OrderStatusBadge status={order.status} />
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
            <h3 className="text-sm font-semibold">{t('order.customerInfo')}</h3>
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
            <h3 className="text-sm font-semibold">{t('order.productInfo')}</h3>
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
                  <span className="text-muted-foreground">{t('order.color')}</span>
                  <div className="font-medium">{order.productColor || '—'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('order.size')}</span>
                  <div className="font-medium">{order.productSize || '—'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('order.quantity')}</span>
                  <div className="font-medium">{order.productQuantity}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('order.price')}</span>
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
              {t('order.updateStatus')}
            </h3>
            <div className="flex gap-2">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((s: OrderStatus) => (
                    <SelectItem key={s} value={s}>
                      {t(`order.status_${s}` as never) || s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleStatusUpdate}
                disabled={updating || selectedStatus === order.status}
                size="sm"
              >
                {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : t('order.save')}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t('order.updateHint')}
            </p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
