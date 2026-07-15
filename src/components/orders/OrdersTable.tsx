'use client';

import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { format } from 'date-fns';
import { fr, enUS, ar } from 'date-fns/locale';
import type { Order } from '@/types';
import { OrderStatusBadge } from './OrderStatusBadge';

interface OrdersTableProps {
  orders: Order[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  search: string;
  statusFilter: string;
  onPageChange: (page: number) => void;
  onSearchChange: (s: string) => void;
  onStatusFilterChange: (s: string) => void;
  onRowClick: (order: Order) => void;
}

export function OrdersTable({
  orders,
  total,
  loading,
  page,
  pageSize,
  search,
  statusFilter,
  onPageChange,
  onSearchChange,
  onStatusFilterChange,
  onRowClick,
}: OrdersTableProps) {
  const { t, locale } = useTranslation();
  const [searchInput, setSearchInput] = useState(search);
  const dateLocale = locale === 'ar' ? ar : locale === 'en' ? enUS : fr;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Debounce search input
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    const timer = setTimeout(() => onSearchChange(value), 300);
    return () => clearTimeout(timer);
  };

  const columns = useMemo(() => [
    { key: 'customerName', label: t('order.colCustomer') },
    { key: 'productName', label: t('order.colProduct') },
    { key: 'customerCity', label: t('order.colCity') },
    { key: 'productPrice', label: t('order.colTotal') },
    { key: 'status', label: t('order.colStatus') },
    { key: 'createdAt', label: t('order.colDate') },
  ], [t]);

  return (
    <div className="space-y-3">
      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <Tabs value={statusFilter} onValueChange={onStatusFilterChange}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs">{t('order.filterAll')}</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs">{t('order.status_pending')}</TabsTrigger>
            <TabsTrigger value="confirmed" className="text-xs">{t('order.status_confirmed')}</TabsTrigger>
            <TabsTrigger value="shipped" className="text-xs">{t('order.status_shipped')}</TabsTrigger>
            <TabsTrigger value="delivered" className="text-xs">{t('order.status_delivered')}</TabsTrigger>
            <TabsTrigger value="cancelled" className="text-xs">{t('order.status_cancelled')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder={t('order.searchPlaceholder')}
            className="h-9 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              {columns.map(col => (
                <TableHead key={col.key} className="text-xs h-9">
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {columns.map(col => (
                    <TableCell key={col.key} className="py-2">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-12 text-center text-muted-foreground">
                  <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">{t('order.empty')}</p>
                </TableCell>
              </TableRow>
            ) : (
              orders.map(order => (
                <TableRow
                  key={order.id}
                  onClick={() => onRowClick(order)}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <TableCell className="text-xs py-2.5">
                    <div className="font-medium">{order.customerName}</div>
                    <div className="text-muted-foreground text-[11px]" dir="ltr">{order.customerPhone}</div>
                  </TableCell>
                  <TableCell className="text-xs py-2.5 max-w-[180px]">
                    <div className="truncate">{order.productName || '—'}</div>
                    {order.productColor && (
                      <div className="text-[11px] text-muted-foreground">
                        {order.productColor} · {order.productSize || ''}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs py-2.5">{order.customerCity}</TableCell>
                  <TableCell className="text-xs py-2.5 font-medium">{order.productPrice || '—'}</TableCell>
                  <TableCell className="py-2.5">
                    <OrderStatusBadge status={order.status} />
                  </TableCell>
                  <TableCell className="text-xs py-2.5 text-muted-foreground whitespace-nowrap">
                    {format(new Date(order.createdAt), 'dd MMM yyyy', { locale: dateLocale })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {t('order.pagination', { from: page * pageSize + 1, to: Math.min((page + 1) * pageSize, total), total }) || `${page * pageSize + 1}-${Math.min((page + 1) * pageSize, total)} / ${total}`}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(0, page - 1))}
              disabled={page === 0 || loading}
              className="h-8"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="px-2 py-1 text-xs">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="h-8"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
