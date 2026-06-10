'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Palette, Wand2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UnknownColorsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unknownColors: { name: string; suggestedHex: string }[];
  onAllValidated: () => void;
}

interface ColorEntry {
  name: string;
  suggestedHex: string;
  hex: string;
  valid: boolean;
}

function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex.trim());
}

export function UnknownColorsDialog({
  open,
  onOpenChange,
  unknownColors,
  onAllValidated,
}: UnknownColorsDialogProps) {
  const [entries, setEntries] = useState<ColorEntry[]>([]);
  const [creating, setCreating] = useState(false);

  // Sync entries when unknownColors prop changes
  useEffect(() => {
    if (open && unknownColors.length > 0) {
      setEntries(
        unknownColors.map(c => ({
          name: c.name,
          suggestedHex: c.suggestedHex,
          hex: c.suggestedHex,
          valid: isValidHex(c.suggestedHex),
        }))
      );
    }
  }, [open, unknownColors]);

  const updateHex = (index: number, hex: string) => {
    setEntries(prev =>
      prev.map((entry, i) =>
        i === index ? { ...entry, hex, valid: isValidHex(hex) } : entry
      )
    );
  };

  const acceptSuggestions = () => {
    setEntries(prev =>
      prev.map(entry => ({
        ...entry,
        hex: entry.suggestedHex,
        valid: isValidHex(entry.suggestedHex),
      }))
    );
  };

  const allValid = entries.length > 0 && entries.every(e => e.valid);

  const handleValidateAll = async () => {
    if (!allValid) return;
    setCreating(true);
    try {
      // Create each unknown color via POST /api/colormap
      for (const entry of entries) {
        const res = await fetch('/api/colormap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: entry.name, hex: entry.hex }),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || `Failed to create color "${entry.name}"`);
        }
      }
      toast.success(`${entries.length} couleur${entries.length > 1 ? 's' : ''} ajoutée${entries.length > 1 ? 's' : ''} à la carte`);
      onAllValidated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la création des couleurs');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span>🎨</span> Nouvelles couleurs détectées
          </DialogTitle>
          <DialogDescription>
            Attribuez un code Hex à chaque nouvelle couleur pour continuer l&apos;import
          </DialogDescription>
        </DialogHeader>

        {entries.length > 0 && (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {entries.map((entry, index) => (
              <div
                key={entry.name}
                className="flex items-center gap-2 p-2 rounded-md border bg-muted/20"
              >
                {/* Color preview circle */}
                <div
                  className="w-7 h-7 rounded-full border border-border shrink-0 shadow-sm transition-colors"
                  style={{ backgroundColor: entry.valid ? entry.hex : '#CCCCCC' }}
                />

                {/* Color name */}
                <span className="text-sm font-semibold min-w-[80px] truncate">
                  {entry.name}
                </span>

                {/* Color picker */}
                <input
                  type="color"
                  value={entry.hex}
                  onChange={e => updateHex(index, e.target.value)}
                  className="w-7 h-7 rounded cursor-pointer border border-input shrink-0"
                />

                {/* Hex text input */}
                <Input
                  value={entry.hex}
                  onChange={e => updateHex(index, e.target.value)}
                  className={cn(
                    'h-7 text-xs font-mono flex-1 min-w-[90px]',
                    !entry.valid && entry.hex && 'border-red-400 focus-visible:ring-red-400'
                  )}
                  placeholder="#RRGGBB"
                />

                {/* Valid indicator */}
                {entry.valid ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                ) : (
                  <div className="w-4 h-4 shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={acceptSuggestions}
            disabled={creating}
            className="gap-1.5"
          >
            <Wand2 className="w-3.5 h-3.5" />
            Valeurs suggérées
          </Button>
          <Button
            size="sm"
            onClick={handleValidateAll}
            disabled={!allValid || creating}
            className="gap-1.5 text-white"
            style={{ backgroundColor: '#C9A84C' }}
          >
            {creating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Palette className="w-3.5 h-3.5" />
            )}
            Valider tout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
