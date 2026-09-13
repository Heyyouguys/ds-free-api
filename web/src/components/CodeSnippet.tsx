import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check, Terminal, Code2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface CodeSnippetProps {
  className?: string;
}

export function CodeSnippet({ className }: CodeSnippetProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'curl' | 'python' | 'node' | 'responses'>('curl');
  const [copied, setCopied] = useState(false);

  const snippets = {
    curl: `${t('codeSnippet.curlComment')}
curl -X POST http://127.0.0.1:22217/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "model": "deepseek-default",
    "messages": [
      {
        "role": "user",
        "content": "${t('codeSnippet.helloMessage')}"
      }
    ],
    "stream": true
  }'`,
    python: `${t('codeSnippet.pythonComment')}
from openai import OpenAI

client = OpenAI(
    api_key="YOUR_API_KEY",
    base_url="http://127.0.0.1:22217/v1"
)

response = client.chat.completions.create(
    model="deepseek-default",
    messages=[
        {"role": "user", "content": "${t('codeSnippet.helloMessage')}"}
    ],
    stream=True
)

for chunk in response:
    content = chunk.choices[0].delta.content
    if content:
        print(content, end="", flush=True)`,
    node: `${t('codeSnippet.nodeComment')}
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "YOUR_API_KEY",
  baseURL: "http://127.0.0.1:22217/v1"
});

const response = await client.chat.completions.create({
  model: "deepseek-default",
  messages: [
    { role: "user", content: "${t('codeSnippet.helloMessage')}" }
  ],
  stream: true,
});

for await (const chunk of response) {
  const content = chunk.choices[0]?.delta?.content || "";
  process.stdout.write(content);
}`,
    responses: `${t('codeSnippet.responsesComment')}
curl -X POST http://127.0.0.1:22217/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "deepseek-default",
    "input": "${t('codeSnippet.helloMessage')}",
    "stream": true
  }'

# ${t('codeSnippet.responsesNote')}
# {"type": "response.output_text.delta", "delta": "..." }`
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(snippets[tab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl overflow-hidden', className)}>
      {/* Terminal Header Bar */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-zinc-900/90 border-b border-zinc-800 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0 overflow-x-auto no-scrollbar">
          {/* macOS Control Dots */}
          <div className="flex items-center gap-1.5 shrink-0 mr-1" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/80 inline-block" />
          </div>

          {/* Language Tabs */}
          <div className="flex items-center h-8 bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 shrink-0" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'curl'}
              onClick={() => setTab('curl')}
              className={cn(
                'flex items-center h-full gap-1.5 px-2.5 text-xs rounded-md transition-all font-medium shrink-0',
                tab === 'curl'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <Terminal className="h-3.5 w-3.5 text-emerald-400" />
              <span>cURL</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'python'}
              onClick={() => setTab('python')}
              className={cn(
                'flex items-center h-full gap-1.5 px-2.5 text-xs rounded-md transition-all font-medium shrink-0',
                tab === 'python'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <Code2 className="h-3.5 w-3.5 text-yellow-400" />
              <span>Python SDK</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'node'}
              onClick={() => setTab('node')}
              className={cn(
                'flex items-center h-full gap-1.5 px-2.5 text-xs rounded-md transition-all font-medium shrink-0',
                tab === 'node'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <Code2 className="h-3.5 w-3.5 text-sky-400" />
              <span>Node.js</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={tab === 'responses'}
              onClick={() => setTab('responses')}
              className={cn(
                'flex items-center h-full gap-1.5 px-2.5 text-xs rounded-md transition-all font-medium shrink-0',
                tab === 'responses'
                  ? 'bg-zinc-800 text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              <Terminal className="h-3.5 w-3.5 text-sky-400" />
              <span>Responses</span>
            </button>
          </div>
        </div>

        {/* Copy Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-8 px-2.5 text-xs gap-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 shrink-0 ml-auto"
          title={t('codeSnippet.copyTitle')}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">{t('common.copied')}</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>{t('common.copy')}</span>
            </>
          )}
        </Button>
      </div>

      {/* Multi-line Preformatted Code Container */}
      <div className="p-4 overflow-x-auto text-zinc-200 bg-zinc-950/90 font-mono text-xs leading-relaxed selection:bg-primary/30 selection:text-white">
        {tab === 'curl' && (
          <pre className="font-mono text-xs leading-relaxed whitespace-pre m-0">
            <code>
              <span className="text-zinc-500 italic">{t('codeSnippet.curlComment')}</span>{'\n'}
              <span className="text-emerald-400 font-bold">curl</span> <span className="text-amber-400">-X POST</span> <span className="text-sky-300">http://127.0.0.1:22217/v1/chat/completions</span> <span className="text-zinc-500">\</span>{'\n'}
              {'  '}<span className="text-amber-400">-H</span> <span className="text-lime-300">"Content-Type: application/json"</span> <span className="text-zinc-500">\</span>{'\n'}
              {'  '}<span className="text-amber-400">-H</span> <span className="text-lime-300">"Authorization: Bearer YOUR_API_KEY"</span> <span className="text-zinc-500">\</span>{'\n'}
              {'  '}<span className="text-amber-400">-d</span> <span className="text-zinc-300">'{'{'}</span>{'\n'}
              {'    '}<span className="text-violet-300 font-semibold">"model"</span>: <span className="text-lime-300">"deepseek-default"</span>,{'\n'}
              {'    '}<span className="text-violet-300 font-semibold">"messages"</span>: [{'\n'}
              {'      '}<span className="text-zinc-300">{'{'}</span>{'\n'}
              {'        '}<span className="text-violet-300">"role"</span>: <span className="text-lime-300">"user"</span>,{'\n'}
              {'        '}<span className="text-violet-300">"content"</span>: <span className="text-lime-300">"{t('codeSnippet.helloMessage')}"</span>{'\n'}
              {'      '}<span className="text-zinc-300">{'}'}</span>{'\n'}
              {'    '}],{'\n'}
              {'    '}<span className="text-violet-300 font-semibold">"stream"</span>: <span className="text-orange-400 font-bold">true</span>{'\n'}
              {'  '}<span className="text-zinc-300">{'}'}'</span>
            </code>
          </pre>
        )}

        {tab === 'python' && (
          <pre className="font-mono text-xs leading-relaxed whitespace-pre m-0">
            <code>
              <span className="text-zinc-500 italic">{t('codeSnippet.pythonComment')}</span>{'\n'}
              <span className="text-purple-400 font-bold">from</span> openai <span className="text-purple-400 font-bold">import</span> <span className="text-yellow-300 font-bold">OpenAI</span>{'\n\n'}
              client = <span className="text-yellow-300 font-bold">OpenAI</span>({'\n'}
              {'    '}api_key=<span className="text-lime-300">"YOUR_API_KEY"</span>,{'\n'}
              {'    '}base_url=<span className="text-lime-300">"http://127.0.0.1:22217/v1"</span>{'\n'}
              ){'\n\n'}
              response = client.chat.completions.<span className="text-sky-300 font-semibold">create</span>({'\n'}
              {'    '}model=<span className="text-lime-300">"deepseek-default"</span>,{'\n'}
              {'    '}messages=[{'\n'}
              {'        '}<span className="text-zinc-300">{'{'}</span><span className="text-lime-300">"role"</span>: <span className="text-lime-300">"user"</span>, <span className="text-lime-300">"content"</span>: <span className="text-lime-300">"{t('codeSnippet.helloMessage')}"</span><span className="text-zinc-300">{'}'}</span>{'\n'}
              {'    '}],{'\n'}
              {'    '}stream=<span className="text-orange-400 font-bold">True</span>{'\n'}
              ){'\n\n'}
              <span className="text-purple-400 font-bold">for</span> chunk <span className="text-purple-400 font-bold">in</span> response:{'\n'}
              {'    '}content = chunk.choices[0].delta.content{'\n'}
              {'    '}<span className="text-purple-400 font-bold">if</span> content:{'\n'}
              {'        '}<span className="text-sky-300 font-semibold">print</span>(content, end=<span className="text-lime-300">""</span>, flush=<span className="text-orange-400 font-bold">True</span>)
            </code>
          </pre>
        )}

        {tab === 'node' && (
          <pre className="font-mono text-xs leading-relaxed whitespace-pre m-0">
            <code>
              <span className="text-zinc-500 italic">{t('codeSnippet.nodeComment')}</span>{'\n'}
              <span className="text-purple-400 font-bold">import</span> <span className="text-yellow-300 font-bold">OpenAI</span> <span className="text-purple-400 font-bold">from</span> <span className="text-lime-300">"openai"</span>;{'\n\n'}
              <span className="text-purple-400 font-bold">const</span> client = <span className="text-purple-400 font-bold">new</span> <span className="text-yellow-300 font-bold">OpenAI</span>(<span className="text-zinc-300">{'{'}</span>{'\n'}
              {'  '}apiKey: <span className="text-lime-300">"YOUR_API_KEY"</span>,{'\n'}
              {'  '}baseURL: <span className="text-lime-300">"http://127.0.0.1:22217/v1"</span>{'\n'}
              <span className="text-zinc-300">{'}'}</span>);{'\n\n'}
              <span className="text-purple-400 font-bold">const</span> response = <span className="text-purple-400 font-bold">await</span> client.chat.completions.<span className="text-sky-300 font-semibold">create</span>(<span className="text-zinc-300">{'{'}</span>{'\n'}
              {'  '}model: <span className="text-lime-300">"deepseek-default"</span>,{'\n'}
              {'  '}messages: [{'\n'}
              {'    '}<span className="text-zinc-300">{'{'}</span> role: <span className="text-lime-300">"user"</span>, content: <span className="text-lime-300">"{t('codeSnippet.helloMessage')}"</span> <span className="text-zinc-300">{'}'}</span>{'\n'}
              {'  '}],{'\n'}
              {'  '}stream: <span className="text-orange-400 font-bold">true</span>,{'\n'}
              <span className="text-zinc-300">{'}'}</span>);{'\n\n'}
              <span className="text-purple-400 font-bold">for await</span> (<span className="text-purple-400 font-bold">const</span> chunk <span className="text-purple-400 font-bold">of</span> response) <span className="text-zinc-300">{'{'}</span>{'\n'}
              {'  '}<span className="text-purple-400 font-bold">const</span> content = chunk.choices[0]?.delta?.content || <span className="text-lime-300">""</span>;{'\n'}
              {'  '}process.stdout.<span className="text-sky-300 font-semibold">write</span>(content);{'\n'}
              <span className="text-zinc-300">{'}'}</span>
            </code>
          </pre>
        )}
      </div>
    </div>
  );
}
