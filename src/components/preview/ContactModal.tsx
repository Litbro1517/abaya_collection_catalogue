'use client';

import { useState, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Send, Mail } from 'lucide-react';
import { useClientTranslation } from '@/lib/i18n';
import { toast } from 'sonner';

// Robust email regex (same as server-side for consistency)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE_LENGTH = 2000;

interface ContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientEmail: string;
}

/**
 * ContactModal — Integrated contact form modal
 *
 * Replaces the old mailto: + clipboard fallback (DEBT-5) with a proper
 * in-app contact form. The user can type their email + message and submit
 * directly without leaving the page or depending on an external mail client.
 *
 * Uses shadcn Dialog (Radix UI) for accessibility + animation.
 * The form posts to /api/contact which stores the message in DB.
 */
export function ContactModal({ open, onOpenChange, recipientEmail }: ContactModalProps) {
  const { t, rtl } = useClientTranslation();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Robust validation (A3 fix — regex instead of simple includes)
    if (!email.trim() || !EMAIL_REGEX.test(email.trim())) {
      toast.error(t('contact.errorEmail'));
      return;
    }
    if (!message.trim() || message.trim().length < 5) {
      toast.error(t('contact.errorMessage'));
      return;
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      toast.error(t('contact.errorMessage'));
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromEmail: email.trim(),
          message: message.trim(),
          toEmail: recipientEmail,
        }),
      });
      const json = await res.json();

      if (!res.ok || json.error) {
        toast.error(json.error || t('contact.errorSend'));
        return;
      }

      toast.success(t('contact.success'));
      setEmail('');
      setMessage('');
      onOpenChange(false);
    } catch {
      toast.error(t('contact.errorSend'));
    } finally {
      setSending(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && sending) return; // Prevent closing while sending
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]" dir={rtl ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4" style={{ color: 'var(--pivot-gold)' }} />
            {t('contact.title')}
          </DialogTitle>
          <DialogDescription>
            {t('contact.subtitle')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sender email */}
          <div className="space-y-1.5">
            <label htmlFor="contact-email" className="text-xs font-medium text-muted-foreground">
              {t('contact.yourEmail')}
            </label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="votre@email.com"
              required
              disabled={sending}
              className="h-9 text-sm"
              dir="ltr"
            />
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <label htmlFor="contact-message" className="text-xs font-medium text-muted-foreground">
              {t('contact.yourMessage')}
            </label>
            <Textarea
              id="contact-message"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={t('contact.messagePlaceholder')}
              required
              disabled={sending}
              maxLength={MAX_MESSAGE_LENGTH}
              dir={rtl ? 'rtl' : 'ltr'}
              className="min-h-[120px] text-sm resize-none"
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={sending}
              className="w-full gap-2"
              style={{
                backgroundColor: 'var(--pivot-brand, #1A3C34)',
                color: 'white',
              }}
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {sending ? t('contact.sending') : t('contact.send')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
