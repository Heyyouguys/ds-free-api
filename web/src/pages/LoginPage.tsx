import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KeyRound, Shield, ArrowRight, Eye, EyeOff, RefreshCw, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { localizeAuthError } from '@/lib/api';

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const { login, setup } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError(t('login.errorPasswordLength'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('login.errorPasswordMismatch'));
      return;
    }
    setLoading(true);
    const result = await setup(password);
    setLoading(false);
    if (result.success) {
      navigate('/', { replace: true });
    } else {
      if (result.error?.includes('已设置') || result.error?.includes('already set')) {
        setNeedsSetup(false);
      }
      setError(localizeAuthError(result.error, i18n.language) || t('login.errorSetupFailed'));
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(password);
    setLoading(false);
    if (result.success) {
      navigate('/', { replace: true });
    } else {
      if (result.error?.includes('未设置密码') || result.error?.includes('not set')) {
        setNeedsSetup(true);
      }
      setError(localizeAuthError(result.error, i18n.language) || t('login.errorLoginFailed'));
    }
  };

  return (
    <div className="min-h-dvh w-full flex flex-col justify-between p-4 sm:p-6 md:p-8 bg-background relative overflow-x-hidden overflow-y-auto select-none">
      {/* ── Top Header Navigation Bar ── */}
      <header className="flex items-center justify-between w-full max-w-5xl mx-auto gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/admin/favicon.svg" alt="DS Free API" className="h-6 w-6 sm:h-7 sm:w-7 shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm sm:text-base leading-none tracking-tight truncate">
              DS Free API
            </span>
            <span className="text-[10px] text-muted-foreground font-mono mt-0.5">v0.2.6</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <LanguageSwitcher className="h-8 text-xs" variant="outline" />
          <ThemeSwitcher className="h-8 text-xs" variant="outline" />
        </div>
      </header>

      {/* ── Centered Auth Container (Flat & borderless on mobile, Card on tablet/desktop) ── */}
      <main className="w-full max-w-md mx-auto my-auto py-4 sm:py-8">
        <Card className="border-0 shadow-none bg-transparent sm:border sm:rounded-2xl sm:bg-card/95 sm:shadow-lg sm:backdrop-blur-md overflow-hidden">
          <CardHeader className="text-center pb-4 pt-2 sm:pt-6 px-0 sm:px-6">
            <div className="mx-auto mb-3 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-2xs">
              {needsSetup ? (
                <Shield className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
              ) : (
                <KeyRound className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
              )}
            </div>
            <CardTitle className="text-lg sm:text-xl font-bold tracking-tight">
              {t('login.title')}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              {needsSetup ? t('login.setupDescription') : t('login.loginDescription')}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-0 sm:px-6 pb-6 pt-0">
            {/* Error Notification */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 text-xs font-medium mb-4 animate-in fade-in-50">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="flex-1">{error}</span>
              </div>
            )}

            {needsSetup ? (
              <form onSubmit={handleSetup} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="setup-password" className="text-xs font-medium">
                    {t('login.setPasswordLabel')}
                  </Label>
                  <div className="relative">
                    <Input
                      id="setup-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={t('login.setPasswordPlaceholder')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className="pr-9 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="setup-confirm" className="text-xs font-medium">
                    {t('login.confirmPasswordLabel')}
                  </Label>
                  <div className="relative">
                    <Input
                      id="setup-confirm"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder={t('login.confirmPasswordPlaceholder')}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      className="pr-9 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                      aria-label="Toggle confirm password visibility"
                    >
                      {showConfirm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-9 text-xs font-medium gap-2 shadow-xs"
                  disabled={loading || !password}
                >
                  {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{loading ? t('login.settingUp') : t('login.setupButton')}</span>
                </Button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setNeedsSetup(false);
                      setError('');
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
                  >
                    <span>{t('login.loginButton')}</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-password" className="text-xs font-medium">
                    {t('login.passwordLabel')}
                  </Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={t('login.passwordPlaceholder')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className="pr-9 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-9 text-xs font-medium gap-2 shadow-xs"
                  disabled={loading || !password}
                >
                  {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  <span>{loading ? t('login.verifying') : t('login.loginButton')}</span>
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>

      {/* ── Footer ── */}
      <footer className="text-center py-2">
        <p className="text-[11px] text-muted-foreground font-mono">
          DS Free API • DeepSeek API Gateway
        </p>
      </footer>
    </div>
  );
}
