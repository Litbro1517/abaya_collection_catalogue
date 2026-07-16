'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/types';

interface OrderStatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_CONFIG: Record<string, { labelKey: string; className: string }> = {
  pending: {
    labelKey: 'order.statusPending',
    className: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100',
  },
  confirmed: {
    labelKey: 'order.statusConfirmed',
    className: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100',
  },
  shipped: {
    labelKey: 'order.statusShipped',
    className: 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100',
  },
  delivered: {
    labelKey: 'order.statusDelivered',
    className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
  },
  cancelled: {
    labelKey: 'order.statusCancelled',
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
  },
};

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <Badge
      variant="outline"
      className={cn('font-medium text-xs', config.className, className)}
    >
      {/* Status text is translated by the caller via t() — but to keep this component
          framework-agnostic we just render a stable label. The OrdersTable maps
          status → translated label before rendering. */}
      {status}
    </Badge>
  );
}

export function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.pending;
}

export const ORDER_STATUS_LIST: OrderStatus[] = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
