'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock, Loader2, BookOpen, X, Mail, User } from 'lucide-react';
import { useClientTranslation } from '@/lib/i18n/useClientTranslation';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

interface LoginModalProps {
  onLoginSuccess?: () => void;
  onCancel?: () => void;
}

type Mode = 'login' | 'register' | 'checking';

export function LoginModal({ onLoginSuccess, onCancel }: LoginModalProps) {
  const [mode, setMode] = useState<Mode>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleUnavailable, setGoogleUnavailable] = useState(false);
  const { setIsAdmin, setAdminUser } = useAppStore();
  const { t } = useClientTranslation();

  // Check if any admins exist on mount
  useEffect(() => {
    const checkAdmins = async () => {
      try {
        const res = await fetch('/api/auth/admins?public_check=true');
        if (res.ok) {
          const json = await res.json();
          if (json.hasAdmins === false) {
            setMode('register');
          } else {
            setMode('login');
          }
        } else {
          // If the endpoint fails or returns 401, assume admins exist
          setMode('login');
        }
      } catch {
        setMode('login');
      }
    };
    checkAdmins();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.data?.admin) {
          setAdminUser(json.data.admin);
        }
        setIsAdmin(true);
        onLoginSuccess?.();
      } else {
        const json = await res.json();
        setError(json.error || t('login.connectionError'));
      }
    } catch {
      setError(t('login.connectionError'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password.length < 8) {
      setError(t('login.passwordMin8'));
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim() || undefined,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.data?.admin) {
          setAdminUser(json.data.admin);
        }
        setIsAdmin(true);
        onLoginSuccess?.();
      } else {
        const json = await res.json();
        setError(json.error || t('login.registerError'));
      }
    } catch {
      setError(t('login.registerError'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      const res = await fetch('/api/google/auth');
      if (res.ok) {
        const json = await res.json();
        if (json.data?.authUrl) {
          window.location.href = json.data.authUrl;
        } else if (json.url) {
          window.location.href = json.url;
        } else {
          setError(t('login.googleUrlUnavailable'));
        }
      } else {
        const json = await res.json();
        if (json.error?.includes('non configur') || json.setupRequired || res.status === 503) {
          setGoogleUnavailable(true);
        } else {
          setError(json.error || t('login.googleConnectError'));
        }
      }
    } catch {
      setGoogleUnavailable(true);
    } finally {
      setGoogleLoading(false);
    }
  };

  // Show loading spinner while checking admin status
  if (mode === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream via-background to-secondary/30 p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-gold animate-spin" />
          <p className="text-sm text-muted-foreground">{t('login.checking')}</p>
        </div>
      </div>
    );
  }

  const isRegister = mode === 'register';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cream via-background to-secondary/30 p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gold/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gold/5 rounded-full blur-3xl" />
      </div>

      {/* Login card */}
      <div className="relative w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl shadow-xl p-8 space-y-6">
          {/* Close button */}
          {onCancel && (
            <button
              onClick={onCancel}
              className="absolute top-4 right-4 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Header */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-gold/10 flex items-center justify-center">
              <BookOpen className="w-7 h-7 text-gold" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Abaya Collection</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isRegister ? t('login.firstSetup') : t('login.adminAccess')}
              </p>
            </div>
          </div>

          {/* First-time setup notice */}
          {isRegister && (
            <div className="bg-gold/5 border border-gold/20 rounded-lg px-4 py-3 text-sm text-muted-foreground">
              {t('login.noAdminNotice')}
            </div>
          )}

          {/* Google Sign In */}
          <Button
            variant="outline"
            className="w-full h-11 gap-2 border-border"
            onClick={handleGoogleLogin}
            disabled={googleLoading || googleUnavailable}
          >
            {googleLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('login.googleConnecting')}
              </>
            ) : (
              <>
                <GoogleIcon className="w-4 h-4" />
                {t('login.signInWithGoogle')}
              </>
            )}
          </Button>

          {googleUnavailable && (
            <p className="text-xs text-muted-foreground text-center">{t('login.googleNotConfigured')}</p>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">{t('login.or')}</span>
            </div>
          </div>

          {/* Login / Register Form */}
          <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-4">
            {/* Name field (register only) */}
            {isRegister && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={t('login.nameOptional')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 pl-10 border-border"
                />
              </div>
            )}

            {/* Email field */}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder={t('login.email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus={!isRegister}
                className="h-11 pl-10 border-border"
              />
            </div>

            {/* Password field */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder={t('login.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus={isRegister}
                className="h-11 pl-10 border-border"
              />
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-gold hover:bg-gold/90 text-gold-foreground"
              disabled={loading || !email || !password}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isRegister ? t('login.creatingAccount') : t('login.connecting')}
                </>
              ) : (
                isRegister ? t('login.createAccount') : t('login.signIn')
              )}
            </Button>
          </form>

          {/* Footer */}
          <p className="text-xs text-muted-foreground text-center">
            {isRegister
              ? t('login.ownerNotice')
              : t('login.enterCredentials')
            }
          </p>
        </div>
      </div>
    </div>
  );
}
