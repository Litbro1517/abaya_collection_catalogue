'use client';

import { useState, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { CLIENT_VARIABLES, CLIENT_GROUP_LABELS } from '@/lib/theme.config';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────

interface ClientStylePanelProps {
  clientOverrides: Record<string, string> | null;
  onChange: (overrides: Record<string, string>) => void;
}

interface VariableEntry {
  varName: string;
  inherits: string;
  label: string;
  group: string;
}

// ─── Group border colors for visual distinction ───────────────────────────

const GROUP_BORDER_COLORS: Record<string, string> = {
  backgrounds: 'border-amber-400',
  text: 'border-slate-400',
  buttons: 'border-emerald-500',
  badges: 'border-rose-400',
  'product-page': 'border-violet-400',
  misc: 'border-gray-400',
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function isValidHex(val: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(val);
}

function normalizeHex(value: string): string {
  let h = value.trim();
  if (h && !h.startsWith('#')) h = '#' + h;
  return h;
}

// ─── Component ────────────────────────────────────────────────────────────

export function ClientStylePanel({
  clientOverrides,
  onChange,
}: ClientStylePanelProps) {
  // Track which groups are expanded (all expanded by default)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        Object.keys(CLIENT_GROUP_LABELS).map((g) => [g, true])
      )
  );

  const overrides = clientOverrides || {};

  // Group variables by their group key
  const grouped = Object.entries(CLIENT_VARIABLES).reduce<
    Record<string, VariableEntry[]>
  >((acc, [varName, config]) => {
    if (!acc[config.group]) acc[config.group] = [];
    acc[config.group].push({ varName, ...config });
    return acc;
  }, {});

  // ─── State helpers ────────────────────────────────────────────────────

  const isCustom = (varName: string): boolean =>
    varName in overrides && overrides[varName] !== '';

  const getEffectiveValue = (varName: string, inherits: string): string => {
    if (isCustom(varName)) return overrides[varName];
    // Read computed value from CSS for the inherited admin variable
    if (typeof document !== 'undefined') {
      const val = getComputedStyle(document.documentElement)
        .getPropertyValue(inherits)
        .trim();
      if (val) return val;
    }
    return '';
  };

  const toggleCustom = (varName: string, inherits: string) => {
    if (isCustom(varName)) {
      // Switch to auto: remove override
      const next = { ...overrides };
      delete next[varName];
      onChange(next);
    } else {
      // Switch to custom: initialize with current admin value
      const currentValue = getEffectiveValue(varName, inherits);
      onChange({ ...overrides, [varName]: currentValue });
    }
  };

  const updateOverride = (varName: string, value: string) => {
    onChange({ ...overrides, [varName]: value });
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-1">
      {/* Group order matching CLIENT_GROUP_LABELS key order */}
      {Object.entries(CLIENT_GROUP_LABELS).map(([group, groupLabel]) => {
        const vars = grouped[group];
        if (!vars || vars.length === 0) return null;

        const expanded = expandedGroups[group] !== false;
        const borderColor = GROUP_BORDER_COLORS[group] || 'border-border';

        return (
          <div key={group} className="mb-4">
            {/* Group header — clickable to expand/collapse */}
            <button
              onClick={() => toggleGroup(group)}
              className="flex items-center gap-2 w-full text-left py-2 hover:bg-muted/30 rounded-md px-1 transition-colors"
              type="button"
            >
              {expanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="text-xs font-semibold uppercase tracking-wider">
                {groupLabel}
              </span>
              <span className="text-[10px] text-muted-foreground ml-1">
                ({vars.length})
              </span>
            </button>

            {expanded && (
              <div
                className={cn(
                  'space-y-2 pl-3 border-l-2 ml-1.5',
                  borderColor
                )}
              >
                {vars.map(({ varName, inherits, label }) => {
                  const custom = isCustom(varName);
                  const effectiveValue = getEffectiveValue(varName, inherits);
                  const displayValue = custom
                    ? overrides[varName] || ''
                    : effectiveValue;

                  return (
                    <div
                      key={varName}
                      className="flex items-center gap-2 py-1 group/row"
                    >
                      {/* Auto/Custom toggle */}
                      <Switch
                        checked={custom}
                        onCheckedChange={() => toggleCustom(varName, inherits)}
                        className="scale-75 origin-center shrink-0"
                        aria-label={`${custom ? 'Personnalisé' : 'Auto'}: ${label}`}
                      />

                      {/* Color preview circle */}
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full border shrink-0 shadow-sm transition-colors',
                          !effectiveValue && 'bg-muted'
                        )}
                        style={
                          effectiveValue
                            ? {
                                backgroundColor: effectiveValue,
                                borderColor: 'var(--border)',
                              }
                            : { borderColor: 'var(--border)' }
                        }
                        title={effectiveValue || 'Aucune valeur'}
                      />

                      {/* Label */}
                      <span
                        className={cn(
                          'text-xs flex-1 truncate transition-colors',
                          custom
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                        )}
                      >
                        {label}
                      </span>

                      {/* Hex input */}
                      <Input
                        value={displayValue}
                        onChange={(e) => {
                          if (!custom) return;
                          updateOverride(varName, e.target.value);
                        }}
                        onBlur={(e) => {
                          if (!custom) return;
                          let val = normalizeHex(e.target.value);
                          if (val && isValidHex(val)) {
                            updateOverride(varName, val);
                          }
                        }}
                        className={cn(
                          'w-20 h-7 text-[10px] font-mono shrink-0',
                          !custom && 'opacity-50 cursor-not-allowed'
                        )}
                        disabled={!custom}
                        maxLength={7}
                        placeholder="#RRGGBB"
                      />

                      {/* Reset button — only visible in custom mode */}
                      {custom && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity"
                              onClick={() => toggleCustom(varName, inherits)}
                              type="button"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            Retour au mode Auto
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
