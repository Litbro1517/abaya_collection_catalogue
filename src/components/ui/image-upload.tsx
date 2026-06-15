'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';

interface ImageUploadProps {
  value: string | null | undefined;
  onChange: (url: string) => void;
  onRemove?: () => void;
  accept?: string;
  className?: string;
}

export function ImageUpload({ value, onChange, onRemove, accept = 'image/*', className }: ImageUploadProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    // Client-side validation
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
    if (!allowedTypes.includes(file.type)) {
      setError(t('upload.invalidType'));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError(t('upload.fileTooLarge'));
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Upload failed');
      }
      const json = await res.json();
      onChange(json.data.url);
    } catch {
      setError(t('upload.error'));
    } finally {
      setUploading(false);
    }
  }, [onChange, t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // Reset input so same file can be re-uploaded
    if (inputRef.current) inputRef.current.value = '';
  }, [uploadFile]);

  const handleRemove = useCallback(() => {
    if (onRemove) onRemove();
    else onChange('');
  }, [onChange, onRemove]);

  // If there's already a value (URL), show preview with remove button
  if (value && !uploading) {
    // For data URLs, show a friendly label instead of the long base64 string
    const isDataUrl = value.startsWith('data:');
    const displayUrl = isDataUrl
      ? t('upload.storedInline')
      : value;

    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0 border border-border/50">
          <img src={value} alt="Preview" className="w-full h-full object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{displayUrl}</p>
        </div>
        <button
          type="button"
          onClick={handleRemove}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
          aria-label={t('upload.remove')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-4 cursor-pointer transition-all duration-200',
          dragOver ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border/60 hover:border-primary/40 hover:bg-muted/30',
          uploading && 'pointer-events-none opacity-60'
        )}
      >
        {uploading ? (
          <>
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <span className="text-xs text-muted-foreground">{t('upload.uploading')}</span>
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground text-center">{t('upload.clickOrDrop')}</span>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
      {error && (
        <p className="text-[10px] text-destructive mt-1">{error}</p>
      )}
    </div>
  );
}
