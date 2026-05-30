'use client';

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dataSourceId: string;
  onImported: () => void;
}

export function ImportCSVDialog({ open, onOpenChange, dataSourceId, onImported }: Props) {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string[][]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsePreview = (text: string) => {
    const lines = text.split('\n').slice(0, 4);
    return lines.map(l => l.split(/[,;\t]/).map(c => c.trim().replace(/^"|"$/g, '')));
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
    setPreview(parsePreview(text));
  };

  const handleImport = async () => {
    if (!csvText && !fileName) return;
    setLoading(true);

    try {
      const formData = new FormData();
      if (fileRef.current?.files?.[0]) {
        formData.append('file', fileRef.current.files[0]);
      } else {
        formData.append('csvText', csvText);
      }

      const res = await fetch(`/api/datasources/${dataSourceId}/import`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const json = await res.json();
        toast.success(`Import réussi: ${json.data?.rowsCreated || 0} lignes, ${json.data?.columnsCreated || 0} colonnes`);
        onImported();
        onOpenChange(false);
        setCsvText('');
        setFileName('');
        setPreview([]);
      } else {
        const json = await res.json();
        toast.error(json.error || 'Erreur d\'import');
      }
    } catch {
      toast.error('Erreur d\'import');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importer des données CSV / Excel
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* File upload */}
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-gold/50 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt,.xlsx"
              className="hidden"
              onChange={handleFile}
            />
            <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">
              {fileName || 'Cliquez pour sélectionner un fichier'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">CSV, TSV ou TXT</p>
          </div>

          {/* Or paste */}
          <div>
            <label className="text-sm font-medium mb-1 block">Ou collez le texte CSV :</label>
            <textarea
              className="w-full h-32 rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Collez votre CSV ici..."
              value={csvText}
              onChange={e => {
                setCsvText(e.target.value);
                setPreview(parsePreview(e.target.value));
              }}
            />
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-1 block">Aperçu :</label>
              <div className="overflow-auto max-h-40 rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted">
                      {preview[0]?.map((h, i) => (
                        <th key={i} className="px-2 py-1.5 text-left font-medium truncate max-w-[150px]">{h || `Col ${i+1}`}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(1).map((row, ri) => (
                      <tr key={ri} className="border-t border-border">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-2 py-1 truncate max-w-[150px]">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleImport} disabled={loading || (!csvText && !fileName)}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importation...</> : 'Importer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
