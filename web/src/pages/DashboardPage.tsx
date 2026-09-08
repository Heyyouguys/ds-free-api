import useSWR from 'swr';
import { apiFetch, type AdminStatusResponse, type StatsSnapshot } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  Zap,
  TrendingUp,
  Coins,
  Box,
  RefreshCw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

function formatUptime(secs: number, t: (key: string) => string): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}${t('dashboard.stats.days')} ${h}${t('dashboard.stats.hours')} ${m}${t('dashboard.stats.minutes')}`;
  if (h > 0) return `${h}${t('dashboard.stats.hours')} ${m}${t('dashboard.stats.minutes')}`;
  return `${m}${t('dashboard.stats.minutes')}`;
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n.toLocaleString()}`;
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: status, mutate: mutateStatus } = useSWR<AdminStatusResponse>(
    '/admin/api/status',
    (url) => apiFetch<AdminStatusResponse>(url),
    { refreshInterval: 5000 }
  );
  const { data: stats, isLoading: statsLoading, mutate: mutateStats } = useSWR<StatsSnapshot>(
    '/admin/api/stats',
    (url) => apiFetch<StatsSnapshot>(url),
    { refreshInterval: 5000 }
  );

  const handleRefresh = () => {
    mutateStatus();
    mutateStats();
  };

  const totalReqs = stats?.total_requests ?? 0;
  const successReqs = stats?.success_requests ?? 0;
  const failedReqs = stats?.failed_requests ?? 0;
  const successRate = totalReqs > 0 ? ((successReqs / totalReqs) * 100).toFixed(1) : '100.0';

  const promptTokens = stats?.total_prompt_tokens ?? 0;
  const completionTokens = stats?.total_completion_tokens ?? 0;
  const totalTokens = promptTokens + completionTokens;
  const promptPercent = totalTokens > 0 ? (promptTokens / totalTokens) * 100 : 50;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-6xl pb-6">
      {/* ── Page Header (Desktop / Tablet) ── */}
      <div className="hidden md:flex items-center justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5 truncate">
            <Activity className="h-6 w-6 text-primary shrink-0" />
            <span className="truncate">{t('dashboard.title')}</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
            {t('dashboard.subtitle')}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="h-8 gap-1.5 text-xs shrink-0"
          title={t('dashboard.refresh')}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', statsLoading && 'animate-spin')} />
          <span>{t('dashboard.refresh')}</span>
        </Button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MOBILE NATIVE LAYOUT (Android M3 Stack)
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="block md:hidden space-y-3.5">
        {/* Android Native Quick Status Pill Header */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-card border shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex h-3 w-3 items-center justify-center shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground truncate">{t('dashboard.gatewayActive')}</span>
              <span className="text-[10px] text-muted-foreground font-mono truncate">
                {t('dashboard.stats.uptime')}: {stats ? formatUptime(stats.uptime_secs, t) : '0m'}
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground shrink-0"
            title={t('dashboard.refresh')}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', statsLoading && 'animate-spin')} />
          </Button>
        </div>

        {/* Hero Card: Total Requests & Success Rate (Android M3 Surface) */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-card to-muted/40 border shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('dashboard.stats.totalRequests')}
            </span>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px] gap-1 px-2 py-0.5 font-mono font-semibold">
              <TrendingUp className="h-3 w-3" />
              {successRate}% {t('common.success')}
            </Badge>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="text-3xl font-extrabold font-mono tracking-tight text-foreground">
              {totalReqs.toLocaleString()}
            </div>
            <div className="text-xs font-mono text-muted-foreground flex items-center gap-2">
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                <CheckCircle2 className="h-3 w-3" /> {successReqs}
              </span>
              <span className="text-red-500 flex items-center gap-0.5">
                <XCircle className="h-3 w-3" /> {failedReqs}
              </span>
            </div>
          </div>

          {/* Android M3 Linear Progress Bar */}
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden flex">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${totalReqs > 0 ? (successReqs / totalReqs) * 100 : 100}%` }}
            />
            <div
              className="h-full bg-red-500 transition-all duration-500"
              style={{ width: `${totalReqs > 0 ? (failedReqs / totalReqs) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* 2-Column Quick Metric Cards (Android M3 Tonal Surface) */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3.5 rounded-2xl bg-card border shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">{t('dashboard.stats.avgLatency')}</span>
              <Clock className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="text-lg font-bold font-mono text-foreground pt-0.5">
              {stats ? formatLatency(stats.avg_latency_ms) : '0ms'}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-card border shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-medium">{t('dashboard.accountPool.idle')}</span>
              <Users className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <div className="text-lg font-bold font-mono text-foreground pt-0.5">
              <span className="text-emerald-600 dark:text-emerald-400">{status?.idle ?? 0}</span>
              <span className="text-xs text-muted-foreground font-normal"> / {status?.total ?? 0} {t('dashboard.accountPool.accounts')}</span>
            </div>
          </div>
        </div>

        {/* Token Usage Card (Android M3 Breakdown) */}
        <div className="p-4 rounded-2xl bg-card border shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Coins className="h-3.5 w-3.5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-foreground block">
                  {t('dashboard.stats.totalTokens')}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {t('dashboard.tokenAccumulation')}
                </span>
              </div>
            </div>
            <div className="text-right font-mono font-bold text-sm text-foreground">
              {formatTokens(totalTokens)}
            </div>
          </div>

          {/* Segmented Token Progress Bar */}
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden flex">
            <div
              className="h-full bg-blue-500 transition-all duration-500"
              style={{ width: `${promptPercent}%` }}
            />
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${100 - promptPercent}%` }}
            />
          </div>

          {/* 2 Divided Metrics: Prompt & Completion */}
          <div className="grid grid-cols-2 divide-x rounded-xl bg-muted/30 py-2">
            <div className="px-3 space-y-0.5 min-w-0">
              <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1 truncate">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 inline-block shrink-0" />
                {t('logs.requestLogs.promptTokens')}
              </span>
              <div className="text-sm font-bold font-mono text-foreground truncate">
                {formatTokens(promptTokens)}
              </div>
            </div>

            <div className="px-3 space-y-0.5 min-w-0">
              <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 truncate">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                {t('logs.requestLogs.completionTokens')}
              </span>
              <div className="text-sm font-bold font-mono text-foreground truncate">
                {formatTokens(completionTokens)}
              </div>
            </div>
          </div>
        </div>

        {/* Account Pool Android Chip Deck */}
        <div className="p-4 rounded-2xl bg-card border shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-semibold text-foreground">
                {t('dashboard.accountPool.title')}
              </span>
            </div>
            <Badge variant="secondary" className="text-[10px] font-mono">
              {status?.total ?? 0} {t('dashboard.accountPool.total')}
            </Badge>
          </div>

          {/* Status Metric Strip (Clean divided row without nested card borders) */}
          <div className="grid grid-cols-4 divide-x rounded-xl bg-muted/30 py-2">
            <div className="text-center px-1">
              <span className="text-xs font-bold font-mono text-green-600 dark:text-green-400 block">
                {status?.idle ?? 0}
              </span>
              <span className="text-[9px] text-muted-foreground truncate block">{t('dashboard.accountPool.idle')}</span>
            </div>
            <div className="text-center px-1">
              <span className="text-xs font-bold font-mono text-amber-500 block">
                {status?.busy ?? 0}
              </span>
              <span className="text-[9px] text-muted-foreground truncate block">{t('dashboard.accountPool.busy')}</span>
            </div>
            <div className="text-center px-1">
              <span className="text-xs font-bold font-mono text-yellow-500 block">
                {status?.error ?? 0}
              </span>
              <span className="text-[9px] text-muted-foreground truncate block">{t('dashboard.accountPool.error')}</span>
            </div>
            <div className="text-center px-1">
              <span className="text-xs font-bold font-mono text-red-500 block">
                {status?.invalid ?? 0}
              </span>
              <span className="text-[9px] text-muted-foreground truncate block">{t('dashboard.accountPool.invalid')}</span>
            </div>
          </div>

          {/* Account List Chips */}
          {status?.accounts && status.accounts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {status.accounts.map((a) => {
                const isBusy = a.state === 'busy';
                const isError = a.state === 'error';
                const isInvalid = a.state === 'invalid';
                return (
                  <Badge
                    key={a.email || a.mobile}
                    variant="outline"
                    className={cn(
                      'text-[10px] py-1 px-2 font-mono gap-1.5',
                      isBusy
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                        : isError
                        ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30'
                        : isInvalid
                        ? 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30'
                        : 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30'
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        isBusy ? 'bg-amber-500' : isError ? 'bg-yellow-500' : isInvalid ? 'bg-red-500' : 'bg-green-500'
                      )}
                    />
                    {a.email || a.mobile}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        {/* Model Statistics List (Mobile Native) */}
        {stats?.models && Object.keys(stats.models).length > 0 && (
          <div className="p-4 rounded-2xl bg-card border shadow-2xs space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Box className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-semibold text-foreground">
                {t('dashboard.stats.models')}
              </span>
            </div>

            <div className="divide-y border rounded-xl overflow-hidden bg-card/40">
              {Object.entries(stats.models).map(([model, ms]) => (
                <div key={model} className="p-3 space-y-2 hover:bg-muted/15 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-foreground truncate">{model}</span>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {ms.requests} req
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 divide-x rounded-lg bg-muted/30 py-1.5 px-1 text-[11px] font-mono">
                    <div className="text-center px-2 min-w-0">
                      <span className="text-[9px] text-muted-foreground block truncate">{t('logs.requestLogs.promptTokens')}</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400 truncate block">
                        {formatTokens(ms.prompt_tokens)}
                      </span>
                    </div>
                    <div className="text-center px-2 min-w-0">
                      <span className="text-[9px] text-muted-foreground block truncate">{t('logs.requestLogs.completionTokens')}</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate block">
                        {formatTokens(ms.completion_tokens)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          DESKTOP & TABLET LAYOUT
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:block space-y-6">
        {/* Stats 4-Grid Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground truncate">{t('dashboard.stats.totalRequests')}</span>
              <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
            <div className="text-2xl font-bold mt-2 font-mono">{totalReqs.toLocaleString()}</div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground truncate">{t('dashboard.stats.successRate')}</span>
              <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
            <div className="text-2xl font-bold mt-2 font-mono">{successRate}%</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-green-600 dark:text-green-400 flex items-center gap-0.5">
                <CheckCircle2 className="h-3 w-3" />
                {successReqs}
              </span>
              <span className="text-[11px] text-red-500 flex items-center gap-0.5">
                <XCircle className="h-3 w-3" />
                {failedReqs}
              </span>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground truncate">{t('dashboard.stats.avgLatency')}</span>
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
            <div className="text-2xl font-bold mt-2 font-mono">
              {stats ? formatLatency(stats.avg_latency_ms) : '-'}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground truncate">{t('dashboard.stats.uptime')}</span>
              <Zap className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>
            <div className="text-2xl font-bold mt-2 font-mono">
              {stats ? formatUptime(stats.uptime_secs, t) : '-'}
            </div>
          </Card>
        </div>

        {/* Token stats card */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Coins className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{t('dashboard.stats.totalTokens')}</span>
          </div>
          <div className="grid grid-cols-3 gap-4 divide-x">
            <div className="text-left pr-4">
              <span className="text-xs text-muted-foreground block">{t('dashboard.stats.totalTokens')}</span>
              <div className="text-2xl font-bold mt-1 font-mono">
                {formatTokens(totalTokens)}
              </div>
            </div>
            <div className="text-left px-4">
              <span className="text-xs text-muted-foreground block">{t('dashboard.stats.promptTokens')}</span>
              <div className="text-2xl font-bold mt-1 font-mono text-blue-600 dark:text-blue-400">
                {formatTokens(promptTokens)}
              </div>
            </div>
            <div className="text-left pl-4">
              <span className="text-xs text-muted-foreground block">{t('dashboard.stats.completionTokens')}</span>
              <div className="text-2xl font-bold mt-1 font-mono text-emerald-600 dark:text-emerald-400">
                {formatTokens(completionTokens)}
              </div>
            </div>
          </div>
        </Card>

        {/* Model Stats Table */}
        {stats?.models && Object.keys(stats.models).length > 0 && (
          <Card>
            <CardHeader className="p-4 pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Box className="h-4 w-4 text-primary" />
                <span>{t('dashboard.stats.models')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('dashboard.stats.model')}</TableHead>
                    <TableHead className="text-right">{t('dashboard.stats.requests')}</TableHead>
                    <TableHead className="text-right">{t('dashboard.stats.prompt')}</TableHead>
                    <TableHead className="text-right">{t('dashboard.stats.completion')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(stats.models).map(([model, ms]) => (
                    <TableRow key={model}>
                      <TableCell className="font-mono text-sm font-medium">{model}</TableCell>
                      <TableCell className="text-right font-mono">{ms.requests}</TableCell>
                      <TableCell className="text-right font-mono text-blue-600 dark:text-blue-400">{formatTokens(ms.prompt_tokens)}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-600 dark:text-emerald-400">{formatTokens(ms.completion_tokens)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Account Pool Summary Card */}
        <Card>
          <CardHeader className="p-4 pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span>{t('dashboard.accountPool.title')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {/* Clean Segmented Metrics Strip (No nested card-in-a-card) */}
            <div className="grid grid-cols-5 divide-x rounded-xl bg-muted/30 py-3 border">
              <div className="text-center px-2">
                <div className="text-2xl font-bold font-mono">{status?.total ?? '-'}</div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{t('dashboard.accountPool.total')}</div>
              </div>
              <div className="text-center px-2">
                <div className="text-2xl font-bold font-mono text-green-600 dark:text-green-400">{status?.idle ?? '-'}</div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{t('dashboard.accountPool.idle')}</div>
              </div>
              <div className="text-center px-2">
                <div className="text-2xl font-bold font-mono text-amber-500">{status?.busy ?? '-'}</div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{t('dashboard.accountPool.busy')}</div>
              </div>
              <div className="text-center px-2">
                <div className="text-2xl font-bold font-mono text-yellow-500">{status?.error ?? '-'}</div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{t('dashboard.accountPool.error')}</div>
              </div>
              <div className="text-center px-2">
                <div className="text-2xl font-bold font-mono text-red-600 dark:text-red-400">{status?.invalid ?? '-'}</div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{t('dashboard.accountPool.invalid')}</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {status?.accounts.map((a) => {
                const isBusy = a.state === 'busy';
                const isError = a.state === 'error';
                const isInvalid = a.state === 'invalid';
                const variant = isBusy ? 'default' : isError ? 'secondary' : isInvalid ? 'destructive' : 'secondary';
                const className = isBusy
                  ? 'bg-amber-500/15 text-amber-700 border-amber-200'
                  : isError
                  ? 'bg-yellow-500/15 text-yellow-700 border-yellow-200'
                  : isInvalid
                  ? 'bg-red-500/15 text-red-700 border-red-200'
                  : 'bg-green-500/15 text-green-700 border-green-200';
                return (
                  <Badge key={a.email || a.mobile} variant={variant} className={className}>
                    {a.email || a.mobile}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
