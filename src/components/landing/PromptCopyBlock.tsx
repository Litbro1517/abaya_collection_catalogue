'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PromptCopyBlockProps {
  title: string;
  content: string;
  variant?: 'prompt' | 'guide';
}

export function PromptCopyBlock({ title, content, variant = 'prompt' }: PromptCopyBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={cn(
        'rounded-lg border p-4 space-y-2',
        variant === 'prompt'
          ? 'bg-blue-50 border-blue-200'
          : 'bg-amber-50 border-amber-200'
      )}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          {variant === 'prompt' ? '🤖' : '📖'} {title}
        </h4>
        <button
          onClick={handleCopy}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors',
            copied
              ? 'bg-green-500 text-white'
              : variant === 'prompt'
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
          )}
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copié !' : 'Copier le prompt'}
        </button>
      </div>
      <pre
        className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto"
        style={{ scrollbarWidth: 'thin' }}
      >
        {content}
      </pre>
    </div>
  );
}
