'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/types';

interface OrderStatusBadgeProps {
  status: string;
  /** Pre-translated label. When provided, renders this instead of the raw status string. */
  label?: string;
  className?: string;
}

const STATUS_CONFIG: Record<string, { className: string }> = {
  pending: {
    className: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100',
  },
  confirmed: {
    className: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100',
  },
  shipped: {
    className: 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100',
  },
  delivered: {
    className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100',
  },
  cancelled: {
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100',
  },
};

export function OrderStatusBadge({ status, label, className }: OrderStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <Badge
      variant="outline"
      className={cn('font-medium text-xs', config.className, className)}
    >
      {label || status}
    </Badge>
  );
}

export function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.pending;
}

export const ORDER_STATUS_LIST: OrderStatus[] = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];