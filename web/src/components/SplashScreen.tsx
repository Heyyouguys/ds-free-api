import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface SplashScreenProps {
  onComplete?: () => void;
  minDurationMs?: number;
}

export function SplashScreen({ onComplete, minDurationMs = 700 }: SplashScreenProps) {
  const [fading, setFading] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFading(true);
      const exitTimer = setTimeout(() => {
        setHidden(true);
        onComplete?.();
      }, 350);
      return () => clearTimeout(exitTimer);
    }, minDurationMs);

    return () => clearTimeout(timer);
  }, [minDurationMs, onComplete]);

  if (hidden) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center bg-background select-none transition-opacity duration-300 ease-out',
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      )}
      aria-hidden="true"
    >
      {/* Subtle radial ambient background glow */}
      <div className="absolute w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      {/* Prestige Brand Emblem */}
      <div className="relative flex flex-col items-center gap-4 z-10">
        <div className="relative flex items-center justify-center">
          {/* Subtle pulsating outer ring */}
          <div className="absolute h-16 w-16 rounded-2xl bg-primary/15 animate-ping opacity-30" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-card border shadow-lg ring-1 ring-black/5 dark:ring-white/10">
            <img src="/admin/favicon.svg" alt="DS Free API" className="h-8 w-8 object-contain" />
          </div>
        </div>

        {/* Title & Tagline */}
        <div className="text-center space-y-1">
          <h1 className="text-lg font-bold tracking-tight text-foreground font-mono">
            DS Free API
          </h1>
          <p className="text-[11px] font-medium text-muted-foreground tracking-wide uppercase">
            DeepSeek API Gateway
          </p>
        </div>

        {/* Minimalist Slim Line Indicator */}
        <div className="w-28 h-0.5 rounded-full bg-muted overflow-hidden mt-2 relative">
          <div className="h-full bg-primary rounded-full animate-indeterminate" />
        </div>
      </div>
    </div>
  );
}
