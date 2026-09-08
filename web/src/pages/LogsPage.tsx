import { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  apiFetch,
  apiFetchRuntimeLogs,
  type RequestLog,
  type RuntimeLogsResponse,
} from '@/lib/api';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ScrollText,
  Terminal,
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle2,
  XCircle,
  Inbox,
  FileCode2,
  RefreshCw,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 50;

function formatTime(ts: number, locale: string): string {
  const loc = locale?.startsWith('id') ? 'id-ID' : locale?.startsWith('zh') ? 'zh-CN' : 'en-US';
  return new Date(ts * 1000).toLocaleString(loc);
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms}ms`;
}

const levelBadge = (level: string) => {
  switch (level.toUpperCase()) {
    case 'ERROR':
      return 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30';
    case 'WARN':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30';
    case 'INFO':
      return 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30';
    case 'DEBUG':
      return 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30';
    default:
      return 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-400 border-zinc-500/30';
  }
};

/** Localize common Chinese backend runtime log strings */
function localizeLogMessage(msg: string, lang: string): string {
  if (lang.startsWith('zh')) return msg;

  const isId = lang.startsWith('id');

  // Exact / Key pattern matches
  if (msg.includes('openai兼容base_url:')) {
    const url = msg.split('base_url:')[1]?.trim() || '';
    return isId ? `Base URL kompatibel OpenAI: ${url}` : `OpenAI compatible base_url: ${url}`;
  }
  if (msg.includes('anthropic兼容base_url:')) {
    const url = msg.split('base_url:')[1]?.trim() || '';
    return isId ? `Base URL kompatibel Anthropic: ${url}` : `Anthropic compatible base_url: ${url}`;
  }
  if (msg.includes('管理面板:')) {
    const url = msg.split('管理面板:')[1]?.trim() || '';
    return isId ? `Panel Admin Dashboard: ${url}` : `Admin Dashboard: ${url}`;
  }
  if (msg.includes('已加载 stats.json')) {
    return isId ? 'stats.json telah dimuat' : 'stats.json loaded';
  }
  if (msg.includes('stats.json 不存在，使用零值')) {
    return isId ? 'stats.json tidak ditemukan, menggunakan nilai awal 0' : 'stats.json not found, using zero initial values';
  }
  if (msg.includes('HTTP 服务已停止，正在清理资源')) {
    return isId ? 'Layanan HTTP dihentikan, sedang membersihkan sumber daya' : 'HTTP service stopped, cleaning up resources';
  }
  if (msg.includes('清理完成')) {
    return isId ? 'Pembersihan selesai' : 'Cleanup completed';
  }
  if (msg.includes('所有账号初始化失败')) {
    return isId ? 'Semua akun gagal diinisialisasi' : 'All accounts failed to initialize';
  }

  // Account pool & retry patterns
  if (msg.includes('账号池无可用账号')) {
    return msg.replace(
      '账号池无可用账号',
      isId ? 'pool akun tidak memiliki akun yang tersedia' : 'account pool has no available accounts'
    );
  }

  // Overloaded & retry wait regex
  const retryWaitMatch = msg.match(/Overloaded,\s*第\s*(\d+)\s*次重试等待\s*(\d+)ms/);
  if (retryWaitMatch) {
    const attempt = retryWaitMatch[1];
    const ms = retryWaitMatch[2];
    return isId
      ? msg.replace(retryWaitMatch[0], `Overloaded, percobaan ulang ke-${attempt} menunggu ${ms}ms`)
      : msg.replace(retryWaitMatch[0], `Overloaded, retry #${attempt} waiting ${ms}ms`);
  }

  // Prompt oversized / history split / chunk write
  if (msg.includes('prompt 超限')) {
    return isId
      ? msg.replace('prompt 超限', 'panjang prompt melebihi batas').replace('触发回退方案', 'memicu mekanisme fallback')
      : msg.replace('prompt 超限', 'prompt length exceeded').replace('触发回退方案', 'triggering fallback mechanism');
  }
  if (msg.includes('触发历史拆分')) {
    return isId ? msg.replace('触发历史拆分', 'pemisahan riwayat dipicu') : msg.replace('触发历史拆分', 'history split triggered');
  }
  if (msg.includes('分块写入')) {
    return isId ? msg.replace('分块写入', 'penulisan chunk') : msg.replace('分块写入', 'chunk writing');
  }

  // Stream & error messages
  if (msg.includes('空 SSE 流')) {
    return isId ? msg.replace('空 SSE 流', 'aliran SSE kosong') : msg.replace('空 SSE 流', 'empty SSE stream');
  }
  if (msg.includes('hint 限流')) {
    return isId ? msg.replace('hint 限流', 'petunjuk pembatasan laju') : msg.replace('hint 限流', 'rate limit hint');
  }
  if (msg.includes('SSE 流返回业务错误')) {
    return isId
      ? msg.replace('SSE 流返回业务错误', 'aliran SSE mengembalikan error bisnis')
      : msg.replace('SSE 流返回业务错误', 'SSE stream returned business error');
  }
  if (msg.includes('清理') && msg.includes('残留 session')) {
    return isId
      ? msg.replace('清理', 'membersihkan').replace('个残留 session', 'sesi tersisa')
      : msg.replace('清理', 'cleaned up').replace('个残留 session', 'remaining sessions');
  }

  // General dictionary fallback replacements for remaining Chinese phrases
  let translated = msg;
  if (isId) {
    translated = translated
      .replace(/账号/g, 'Akun')
      .replace(/初始化失败/g, 'gagal diinisialisasi')
      .replace(/客户端错误/g, 'Error Klien')
      .replace(/请求失败/g, 'permintaan gagal')
      .replace(/第 (\d+) 次重试/g, 'percobaan ulang ke-$1')
      .replace(/等待 (\d+)ms/g, 'menunggu $1ms');
  } else {
    translated = translated
      .replace(/账号/g, 'Account')
      .replace(/初始化失败/g, 'failed to initialize')
      .replace(/客户端错误/g, 'Client error')
      .replace(/请求失败/g, 'request failed')
      .replace(/第 (\d+) 次重试/g, 'retry #$1')
      .replace(/等待 (\d+)ms/g, 'waiting $1ms');
  }

  return translated;
}

// ── Request Logs Tab ────────────────────────────────────────────────────────

function RequestLogsTab() {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');

  const { data: logs, isLoading, mutate } = useSWR<RequestLog[]>(
    '/admin/api/logs?limit=100',
    (url: string) => apiFetch<RequestLog[]>(url),
    { refreshInterval: 5000 },
  );

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    return logs.filter((log) => {
      const matchSearch =
        !search ||
        log.model.toLowerCase().includes(search.toLowerCase()) ||
        log.api_key.toLowerCase().includes(search.toLowerCase()) ||
        log.request_id?.toLowerCase().includes(search.toLowerCase());

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'success' && log.success) ||
        (statusFilter === 'failed' && !log.success);

      return matchSearch && matchStatus;
    });
  }, [logs, search, statusFilter]);

  return (
    <Card className="border shadow-sm overflow-hidden">
      <CardHeader className="p-3 sm:p-4 pb-3 sm:pb-3">
        <div className="flex items-center justify-between gap-2.5 min-w-0">
          {/* Left: Status Filter Pills (Consistent h-8) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 min-w-0">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={cn(
                'h-8 px-2.5 text-xs rounded-lg font-medium transition-colors shrink-0 flex items-center',
                statusFilter === 'all'
                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {t('logs.all')} ({logs?.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('success')}
              className={cn(
                'h-8 px-2.5 text-xs rounded-lg font-medium transition-colors shrink-0 flex items-center',
                statusFilter === 'success'
                  ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {t('logs.requestLogs.success')} ({logs?.filter((l) => l.success).length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('failed')}
              className={cn(
                'h-8 px-2.5 text-xs rounded-lg font-medium transition-colors shrink-0 flex items-center',
                statusFilter === 'failed'
                  ? 'bg-red-600 text-white font-semibold shadow-xs'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {t('logs.requestLogs.failure')} ({logs?.filter((l) => !l.success).length ?? 0})
            </button>
          </div>

          {/* Right: Search Input + Refresh Button */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('logs.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs w-28 sm:w-52"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => mutate()}
              className="h-8 w-8 p-0 shrink-0"
              title={t('common.refresh')}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Desktop / Tablet Table View */}
        <div className="hidden md:block border-t overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-48 text-xs font-semibold">{t('logs.requestLogs.time')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('logs.requestLogs.model')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('logs.requestLogs.apiKey')}</TableHead>
                <TableHead className="text-right text-xs font-semibold">{t('logs.requestLogs.promptTokens')}</TableHead>
                <TableHead className="text-right text-xs font-semibold">{t('logs.requestLogs.completionTokens')}</TableHead>
                <TableHead className="text-right text-xs font-semibold">{t('logs.requestLogs.latency')}</TableHead>
                <TableHead className="w-28 text-center text-xs font-semibold">{t('logs.requestLogs.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log, i) => (
                <TableRow key={log.request_id || i} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                    {formatTime(log.timestamp, i18n.language)}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-medium text-foreground">
                    <Badge variant="secondary" className="font-normal font-mono text-[11px]">
                      {log.model}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    <span className="bg-muted/70 px-1.5 py-0.5 rounded border text-[11px]">
                      {log.api_key.length > 16 ? `${log.api_key.slice(0, 8)}...${log.api_key.slice(-4)}` : log.api_key}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-xs font-mono text-blue-600 dark:text-blue-400 font-medium">
                    {formatTokens(log.prompt_tokens)}
                  </TableCell>
                  <TableCell className="text-right text-xs font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                    {formatTokens(log.completion_tokens)}
                  </TableCell>
                  <TableCell className="text-right text-xs font-mono text-muted-foreground">
                    {formatLatency(log.latency_ms)}
                  </TableCell>
                  <TableCell className="text-center">
                    {log.success ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 text-[11px] gap-1 px-2">
                        <CheckCircle2 className="h-3 w-3" />
                        {t('logs.requestLogs.success')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30 text-[11px] gap-1 px-2">
                        <XCircle className="h-3 w-3" />
                        {t('logs.requestLogs.failure')}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}

              {isLoading &&
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 rounded-md" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-5 w-16 mx-auto rounded-full" /></TableCell>
                  </TableRow>
                ))}

              {!isLoading && filteredLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-muted-foreground">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-2">
                        <Inbox className="h-5 w-5 text-muted-foreground/60" />
                      </div>
                      <p className="text-sm font-medium text-foreground">{t('logs.requestLogs.empty')}</p>
                      <p className="text-xs text-muted-foreground mt-1 text-center">
                        {t('logs.requestLogs.emptyDesc')}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Native Card View (Android / iOS Stack) */}
        <div className="block md:hidden border-t divide-y">
          {isLoading &&
            Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="p-3.5 space-y-3 bg-card">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-28 rounded-md" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-12 w-full rounded-lg" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            ))}

          {!isLoading && filteredLogs.length === 0 && (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-2">
                <Inbox className="h-5 w-5 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-foreground">{t('logs.requestLogs.empty')}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('logs.requestLogs.emptyDesc')}
              </p>
            </div>
          )}

          {!isLoading &&
            filteredLogs.map((log, i) => (
              <div key={log.request_id || i} className="p-3.5 space-y-2.5 bg-card hover:bg-muted/15 transition-colors">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <Badge variant="secondary" className="font-mono text-xs font-semibold truncate max-w-[200px]">
                    {log.model}
                  </Badge>
                  {log.success ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 text-[10px] gap-1 shrink-0">
                      <CheckCircle2 className="h-3 w-3" />
                      {t('logs.requestLogs.success')}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30 text-[10px] gap-1 shrink-0">
                      <XCircle className="h-3 w-3" />
                      {t('logs.requestLogs.failure')}
                    </Badge>
                  )}
                </div>

                {/* Divided Metric Strip */}
                <div className="grid grid-cols-3 divide-x rounded-lg bg-muted/30 py-2 px-1 text-center font-mono">
                  <div className="px-1 min-w-0">
                    <span className="text-[10px] text-muted-foreground block truncate">Prompt</span>
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 truncate block">
                      {formatTokens(log.prompt_tokens)}
                    </span>
                  </div>
                  <div className="px-1 min-w-0">
                    <span className="text-[10px] text-muted-foreground block truncate">Completion</span>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate block">
                      {formatTokens(log.completion_tokens)}
                    </span>
                  </div>
                  <div className="px-1 min-w-0">
                    <span className="text-[10px] text-muted-foreground block truncate">Latency</span>
                    <span className="text-xs font-semibold text-muted-foreground truncate block">
                      {formatLatency(log.latency_ms)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono pt-0.5 min-w-0">
                  <span className="bg-muted px-1.5 py-0.5 rounded border text-[10px] truncate max-w-[150px]">
                    {log.api_key.length > 12 ? `${log.api_key.slice(0, 6)}...${log.api_key.slice(-4)}` : log.api_key}
                  </span>
                  <span className="truncate ml-2">{formatTime(log.timestamp, i18n.language)}</span>
                </div>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Runtime Logs Tab ────────────────────────────────────────────────────────

function RuntimeLogsTab() {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState(0);
  const offset = page * PAGE_SIZE;

  const { data, isLoading, mutate } = useSWR<RuntimeLogsResponse>(
    `/admin/api/runtime-logs?offset=${offset}&limit=${PAGE_SIZE}`,
    () => apiFetchRuntimeLogs(offset, PAGE_SIZE),
    { refreshInterval: 3000 },
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <Card className="border shadow-sm overflow-hidden">
      <CardHeader className="p-3 sm:p-4 pb-3 sm:pb-3">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <CardDescription className="text-xs truncate min-w-0 flex-1">
            {t('logs.runtimeLogs.description', { total: data?.total ?? '-' })}
          </CardDescription>

          <Button
            variant="outline"
            size="sm"
            onClick={() => mutate()}
            className="h-8 gap-1.5 text-xs shrink-0"
            title={t('common.refresh')}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('common.refresh')}</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Desktop / Tablet Table View */}
        <div className="hidden md:block border-t overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-48 text-xs font-semibold">{t('logs.runtimeLogs.time')}</TableHead>
                <TableHead className="w-24 text-center text-xs font-semibold">{t('logs.runtimeLogs.level')}</TableHead>
                <TableHead className="w-44 text-xs font-semibold">{t('logs.runtimeLogs.module')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('logs.runtimeLogs.message')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.logs.map((log, i) => (
                <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap font-mono">
                    {log.timestamp}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={cn('text-[10px] font-semibold uppercase px-1.5 py-0', levelBadge(log.level))}>
                      {log.level}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 font-normal">
                      {log.target}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono text-foreground break-all">
                    {localizeLogMessage(log.message, i18n.language)}
                  </TableCell>
                </TableRow>
              ))}

              {isLoading &&
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="text-center"><Skeleton className="h-5 w-14 mx-auto rounded-md" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full max-w-md" /></TableCell>
                  </TableRow>
                ))}

              {!isLoading && data && data.logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-muted-foreground">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-2">
                        <Terminal className="h-5 w-5 text-muted-foreground/60" />
                      </div>
                      <p className="text-sm font-medium text-foreground">{t('logs.runtimeLogs.empty')}</p>
                      <p className="text-xs text-muted-foreground mt-1 text-center">
                        {t('logs.runtimeLogs.emptyDesc')}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Native Card View */}
        <div className="block md:hidden border-t divide-y">
          {isLoading &&
            Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="p-3.5 space-y-2 bg-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-14 rounded-md" />
                    <Skeleton className="h-5 w-24 rounded-md" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
            ))}

          {!isLoading && data && data.logs.length === 0 && (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-2">
                <Terminal className="h-5 w-5 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-foreground">{t('logs.runtimeLogs.empty')}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('logs.runtimeLogs.emptyDesc')}
              </p>
            </div>
          )}

          {!isLoading &&
            data?.logs.map((log, i) => (
              <div key={i} className="p-3.5 space-y-2 bg-card hover:bg-muted/15 transition-colors">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className={cn('text-[10px] font-semibold uppercase px-1.5 py-0 shrink-0', levelBadge(log.level))}>
                      {log.level}
                    </Badge>
                    <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 font-normal truncate max-w-[140px]">
                      {log.target}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">{log.timestamp.split('T')[1]?.split('+')[0] || log.timestamp}</span>
                </div>
                <div className="text-xs font-mono text-foreground leading-relaxed break-all bg-muted/30 p-2.5 rounded-lg border">
                  {localizeLogMessage(log.message, i18n.language)}
                </div>
              </div>
            ))}
        </div>

        {/* Pagination Toolbar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
            <span className="text-xs text-muted-foreground">
              {t('logs.runtimeLogs.pageInfo', { current: page + 1, total: totalPages })}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {t('logs.runtimeLogs.prev')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                {t('logs.runtimeLogs.next')}
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Logs Page ─────────────────────────────────────────────────────────

export function LogsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'request' | 'runtime'>('request');

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5 truncate">
            <ScrollText className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
            <span className="truncate">{t('logs.title')}</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
            {t('logs.subtitle')}
          </p>
        </div>

        {/* Tab Buttons Container with consistent h-9 height */}
        <div className="flex items-center h-9 p-0.5 bg-muted rounded-xl border shrink-0">
          <button
            type="button"
            onClick={() => setTab('request')}
            className={cn(
              'flex items-center h-full gap-1.5 px-3 text-xs font-medium rounded-lg transition-all shrink-0',
              tab === 'request'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <FileCode2 className="h-3.5 w-3.5" />
            <span>{t('logs.tabs.request')}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('runtime')}
            className={cn(
              'flex items-center h-full gap-1.5 px-3 text-xs font-medium rounded-lg transition-all shrink-0',
              tab === 'runtime'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>{t('logs.tabs.runtime')}</span>
          </button>
        </div>
      </div>

      {tab === 'request' ? <RequestLogsTab /> : <RuntimeLogsTab />}
    </div>
  );
}
