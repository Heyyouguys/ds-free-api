import { useState } from 'react';
import useSWR from 'swr';
import { apiFetch, type ModelListResponse, type ModelInfo } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Boxes,
  Copy,
  Check,
  Cpu,
  ArrowDownToLine,
  ArrowUpFromLine,
  Layers,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import { CodeSnippet } from '@/components/CodeSnippet';

function formatTokens(n?: number): string {
  if (!n) return '-';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M (${n.toLocaleString()})`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K (${n.toLocaleString()})`;
  return n.toLocaleString();
}

function ModelCard({ model }: { model: ModelInfo }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(model.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Clean provider display
  const providerLabel = model.owned_by?.includes('deepseek')
    ? 'DeepSeek Web Proxy'
    : model.owned_by || 'DeepSeek';

  const isExpert = model.id.includes('expert') || model.id.includes('reasoner');

  return (
    <Card className="flex flex-col justify-between overflow-hidden border shadow-sm transition-all hover:shadow-md hover:border-primary/40">
      <CardHeader className="p-3.5 sm:p-4 pb-3 sm:pb-3">
        <div className="flex items-center justify-between gap-2.5 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              {isExpert ? <Sparkles className="h-4.5 w-4.5" /> : <Cpu className="h-4.5 w-4.5" />}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm sm:text-base font-bold font-mono tracking-tight truncate" title={model.id}>
                {model.id}
              </CardTitle>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal truncate max-w-[130px]">
                  {providerLabel}
                </Badge>
                <Badge variant="outline" className="text-[10px] text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/10 px-1.5 py-0 shrink-0">
                  {t('models.readyStatus')}
                </Badge>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="shrink-0 h-8 px-2.5 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            title={t('models.copyId')}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                <span className="text-green-600 dark:text-green-400 font-medium">{t('models.copied')}</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>{t('common.copy')}</span>
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {/* Token Specs Strip (Clean divided row without nested card borders) */}
        <div className="grid grid-cols-2 divide-x rounded-lg bg-muted/30 py-2">
          <div className="space-y-0.5 px-3 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
              <ArrowDownToLine className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate">{t('models.contextWindow')}</span>
            </div>
            <div className="font-semibold text-sm font-mono text-foreground truncate">
              {formatTokens(model.max_input_tokens || model.context_length || 1048576)}
            </div>
          </div>

          <div className="space-y-0.5 px-3 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
              <ArrowUpFromLine className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="truncate">{t('models.maxOutput')}</span>
            </div>
            <div className="font-semibold text-sm font-mono text-foreground truncate">
              {formatTokens(model.max_output_tokens || 384000)}
            </div>
          </div>
        </div>

        {/* Endpoints */}
        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 min-w-0">
            <Layers className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{t('models.endpoints')}</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-muted/40 font-mono text-muted-foreground min-w-0">
              <span className="text-primary font-medium shrink-0">OpenAI:</span>
              <span className="text-foreground truncate ml-2">/v1/chat/completions</span>
            </div>
            <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-muted/40 font-mono text-muted-foreground min-w-0">
              <span className="text-primary font-medium shrink-0">Anthropic:</span>
              <span className="text-foreground truncate ml-2">/anthropic/v1/messages</span>
            </div>
          </div>
        </div>

        {/* Features / Capabilities */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge variant="outline" className="text-[10px] gap-1 py-0.5 text-muted-foreground">
            <Zap className="h-3 w-3 text-amber-500" /> Streaming SSE
          </Badge>
          <Badge variant="outline" className="text-[10px] gap-1 py-0.5 text-muted-foreground">
            <Cpu className="h-3 w-3 text-blue-500" /> Function Calling
          </Badge>
          <Badge variant="outline" className="text-[10px] gap-1 py-0.5 text-muted-foreground">
            <Sparkles className="h-3 w-3 text-purple-500" /> Thinking Mode
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export function ModelsPage() {
  const { t } = useTranslation();
  const { data: models, isLoading } = useSWR<ModelListResponse>(
    '/admin/api/models',
    (url: string) => apiFetch<ModelListResponse>(url),
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5 truncate">
          <Boxes className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0" />
          <span className="truncate">{t('models.title')}</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
          {t('models.description')}
        </p>
      </div>

      {/* Model Cards Grid */}
      <div className="grid gap-5 md:grid-cols-2">
        {models?.data.map((model) => (
          <ModelCard key={model.id} model={model} />
        ))}

        {isLoading &&
          Array.from({ length: 2 }).map((_, idx) => (
            <Card key={idx} className="flex flex-col justify-between overflow-hidden border shadow-sm p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-9 w-9 rounded-xl" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-8 w-16 rounded-md" />
              </div>
              <Skeleton className="h-14 w-full rounded-lg" />
              <div className="space-y-1.5">
                <Skeleton className="h-7 w-full rounded-lg" />
                <Skeleton className="h-7 w-full rounded-lg" />
              </div>
            </Card>
          ))}

        {models && models.data.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-12 rounded-xl border border-dashed">
            <Boxes className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm">{t('models.empty')}</p>
          </div>
        )}
      </div>

      {/* Integration Quick Guide with full syntax highlighting */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">{t('models.quickStart')}</h2>
        </div>
        <CodeSnippet />
      </div>
    </div>
  );
}
