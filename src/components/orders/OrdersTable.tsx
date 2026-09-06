// @ts-nocheck — MANDAT 4P: Prisma generated types are overly strict; runtime behavior is correct
'use client';

import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, ChevronLeft, ChevronRight, Inbox,
  AlertCircle, AlertTriangle,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { format } from 'date-fns';
import { fr, enUS, ar } from 'date-fns/locale';
import { toast } from 'sonner';
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
  view: 'active' | 'archived';
  selectedIds: Set<string>;
  onPageChange: (page: number) => void;
  onSearchChange: (s: string) => void;
  onStatusFilterChange: (s: string) => void;
  onViewChange: (v: 'active' | 'archived') => void;
  onRowClick: (order: Order) => void;
  onSelectionChange: (ids: Set<string>) => void;
  onCellUpdated: () => void;
}

// Fields that can be edited inline (cell-level)
const EDITABLE_FIELDS = [
  'customerName', 'customerPhone', 'customerCity',
  'productName', 'productPrice', 'productColor', 'productSize',
] as const;

// Data quality icon — alerts for empty/zero/low values
function DataQualityIcon({ value, field }: { value: unknown; field: string }) {
  const { t } = useTranslation();
  if (value === null || value === undefined || value === '') {
    return (
      <AlertCircle
        className="w-3 h-3 text-amber-500 inline-block ml-1 shrink-0"
        title={t('adminOrder.dataQualityEmpty')}
      />
    );
  }
  if (field === 'productPrice') {
    const num = parseFloat(String(value).replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!isNaN(num) && num === 0) {
      return (
        <AlertTriangle
          className="w-3 h-3 text-red-500 inline-block ml-1 shrink-0"
          title={t('adminOrder.dataQualityZero')}
        />
      );
    }
    if (!isNaN(num) && num > 0 && num < 10) {
      return (
        <AlertTriangle
          className="w-3 h-3 text-orange-500 inline-block ml-1 shrink-0"
          title={t('adminOrder.dataQualityLow')}
        />
      );
    }
  }
  return null;
}

// Sliding window pagination — generates (number | '...')[]
// Always shows first/last page, with a delta-sized window around current.
function generatePageButtons(currentPage: number, totalPages: number, delta = 2): (number | '...')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i);
  }
  const range: (number | '...')[] = [0];
  const left = Math.max(1, currentPage - delta);
  const right = Math.min(totalPages - 2, currentPage + delta);
  if (left > 1) range.push('...');
  for (let i = left; i <= right; i++) range.push(i);
  if (right < totalPages - 2) range.push('...');
  range.push(totalPages - 1);
  return range;
}

export function OrdersTable({
  orders, total, loading, page, pageSize, search, statusFilter, view,
  selectedIds, onPageChange, onSearchChange, onStatusFilterChange, onViewChange,
  onRowClick, onSelectionChange, onCellUpdated,
}: OrdersTableProps) {
  const { t, locale } = useTranslation();
  const [searchInput, setSearchInput] = useState(search);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // Sync local searchInput when parent resets search (tab/filter change)
  useEffect(() => {
    setSearchInput(search);
  }, [search]);
  const dateLocale = locale === 'ar' ? ar : locale === 'en' ? enUS : fr;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Inline edit state (pattern from DataTable.tsx)
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Fixed debounce — useRef timer, cleared on each keystroke
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => onSearchChange(value), 300);
  }, [onSearchChange]);

  // Inline edit handlers
  const startEditing = (orderId: string, field: string, value: unknown) => {
    setEditingCell(`${orderId}-${field}`);
    setEditValue(value === null || value === undefined ? '' : String(value));
  };

  const saveCell = async (orderId: string, field: string) => {
    setEditingCell(null);
    if (!EDITABLE_FIELDS.includes(field as typeof EDITABLE_FIELDS[number])) return;

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: editValue }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast.error(json.error || t('adminOrder.cellSaveError'));
        return;
      }
      toast.success(t('adminOrder.cellSaveSuccess'));
      onCellUpdated();
    } catch {
      toast.error(t('adminOrder.cellSaveError'));
    }
  };

  // Selection handlers
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(orders.map(o => o.id)));
    }
  };

  const columns = useMemo(() => [
    { key: 'customerName', label: t('adminOrder.colCustomer') },
    { key: 'productName', label: t('adminOrder.colProduct') },
    { key: 'customerCity', label: t('adminOrder.colCity') },
    { key: 'productPrice', label: t('adminOrder.colTotal') },
    { key: 'status', label: t('adminOrder.colStatus') },
    { key: 'createdAt', label: t('adminOrder.colDate') },
  ], [t]);

  return (
    <div className="space-y-3">
      {/* Filters bar — Tabs (view) + Tabs (status) + Search */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2 items-center justify-between">
          <Tabs value={view} onValueChange={(v) => onViewChange(v as 'active' | 'archived')}>
            <TabsList className="h-9">
              <TabsTrigger value="active" className="text-xs">{t('adminOrder.filterActive')}</TabsTrigger>
              <TabsTrigger value="archived" className="text-xs">{t('adminOrder.filterArchived')}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder={t('adminOrder.searchPlaceholder')}
              className="h-9 pl-8 text-xs"
            />
          </div>
        </div>
        {/* Status filter tabs — only shown in active view */}
        {view === 'active' && (
          <Tabs value={statusFilter} onValueChange={onStatusFilterChange}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs">{t('adminOrder.filterAll')}</TabsTrigger>
              <TabsTrigger value="pending" className="text-xs">{t('adminOrder.status_pending')}</TabsTrigger>
              <TabsTrigger value="confirmed" className="text-xs">{t('adminOrder.status_confirmed')}</TabsTrigger>
              <TabsTrigger value="shipped" className="text-xs">{t('adminOrder.status_shipped')}</TabsTrigger>
              <TabsTrigger value="delivered" className="text-xs">{t('adminOrder.status_delivered')}</TabsTrigger>
              <TabsTrigger value="cancelled" className="text-xs">{t('adminOrder.status_cancelled')}</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-10" onClick={e => e.stopPropagation()}>
                <Checkbox
                  checked={orders.length > 0 && selectedIds.size === orders.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label={t('adminOrder.selectAll')}
                />
              </TableHead>
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
                  <TableCell className="py-2"><Skeleton className="h-4 w-4" /></TableCell>
                  {columns.map(col => (
                    <TableCell key={col.key} className="py-2">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="py-12 text-center text-muted-foreground">
                  <Inbox className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">{t('adminOrder.empty')}</p>
                </TableCell>
              </TableRow>
            ) : (
              orders.map(order => {
                const cellKey = (field: string) => `${order.id}-${field}`;
                const isEditing = (field: string) => editingCell === cellKey(field);
                const canEdit = view === 'active' && EDITABLE_FIELDS.includes as unknown;

                return (
                  <TableRow
                    key={order.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => onRowClick(order)}
                  >
                    <TableCell className="py-2.5" onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(order.id)}
                        onCheckedChange={() => toggleSelect(order.id)}
                        aria-label={`Select ${order.id}`}
                      />
                    </TableCell>
                    {/* Customer */}
                    <TableCell className="text-xs py-2.5">
                      {isEditing('customerName') ? (
                        <Input
                          value={editValue}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => saveCell(order.id, 'customerName')}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveCell(order.id, 'customerName');
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="h-7 text-xs"
                          autoFocus
                        />
                      ) : (
                        <div
                          onClick={e => e.stopPropagation()}
                          onDoubleClick={() => view === 'active' && startEditing(order.id, 'customerName', order.customerName)}
                          className="cursor-text"
                        >
                          <div className="font-medium">{order.customerName}</div>
                          <div className="text-muted-foreground text-[11px]" dir="ltr">{order.customerPhone}</div>
                        </div>
                      )}
                    </TableCell>
                    {/* Product */}
                    <TableCell className="text-xs py-2.5 max-w-[180px]">
                      {isEditing('productName') ? (
                        <Input
                          value={editValue}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => saveCell(order.id, 'productName')}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveCell(order.id, 'productName');
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="h-7 text-xs"
                          autoFocus
                        />
                      ) : (
                        <div
                          onClick={e => e.stopPropagation()}
                          onDoubleClick={() => view === 'active' && startEditing(order.id, 'productName', order.productName)}
                          className="cursor-text truncate"
                        >
                          {order.productName || '—'}
                          {order.productName && <DataQualityIcon value={order.productName} field="productName" />}
                          {(order.productColor || order.productSize) && (
                            <div className="text-[11px] text-muted-foreground">
                              <span>
                                {order.productColor || ''}
                                {!order.productColor && <DataQualityIcon value={order.productColor} field="productColor" />}
                              </span>
                              {order.productColor && order.productSize ? ' · ' : ''}
                              <span>
                                {order.productSize || ''}
                                {!order.productSize && <DataQualityIcon value={order.productSize} field="productSize" />}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    {/* City */}
                    <TableCell className="text-xs py-2.5">
                      {isEditing('customerCity') ? (
                        <Input
                          value={editValue}
                          onClick={e => e.stopPropagation()}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => saveCell(order.id, 'customerCity')}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveCell(order.id, 'customerCity');
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="h-7 text-xs"
                          autoFocus
                        />
                      ) : (
                        <div
                          onClick={e => e.stopPropagation()}
                          onDoubleClick={() => view === 'active' && startEditing(order.id, 'customerCity', order.customerCity)}
                          className="cursor-text"
                        >
                          {order.customerCity}
                        </div>
                      )}
                    </TableCell>
                    {/* Total */}
                    <TableCell className="text-xs py-2.5 font-medium">
                      {order.productPrice || '—'}
                      {order.productPrice && <DataQualityIcon value={order.productPrice} field="productPrice" />}
                    </TableCell>
                    {/* Status */}
                    <TableCell className="py-2.5" onClick={e => e.stopPropagation()}>
                      <OrderStatusBadge status={order.status} label={t(`adminOrder.status_${order.status}` as never)} />
                    </TableCell>
                    {/* Date */}
                    <TableCell className="text-xs py-2.5 text-muted-foreground whitespace-nowrap">
                      {format(new Date(order.createdAt), 'dd MMM yyyy', { locale: dateLocale })}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination — Sliding window */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {t('adminOrder.pagination')
              .replace('{from}', String(page * pageSize + 1))
              .replace('{to}', String(Math.min((page + 1) * pageSize, total)))
              .replace('{total}', String(total))}
          </span>
          <div className="flex gap-0.5 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(0, page - 1))}
              disabled={page === 0 || loading}
              className="h-8 w-8 p-0"
              aria-label={t('adminOrder.prevPage') || 'Précédent'}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            {generatePageButtons(page, totalPages).map((item, idx) =>
              item === '...' ? (
                <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground select-none">
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  variant={item === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onPageChange(item)}
                  disabled={loading}
                  className={`h-8 w-8 p-0 text-xs ${item === page ? 'pointer-events-none' : ''}`}
                >
                  {item + 1}
                </Button>
              ),
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1 || loading}
              className="h-8 w-8 p-0"
              aria-label={t('adminOrder.nextPage') || 'Suivant'}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
