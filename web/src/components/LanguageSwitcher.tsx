import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Languages } from 'lucide-react';
import { cn } from '@/lib/utils';

const languages = [
  { code: 'zh', labelKey: 'language.zh' },
  { code: 'en', labelKey: 'language.en' },
  { code: 'id', labelKey: 'language.id' },
] as const;

interface LanguageSwitcherProps {
  className?: string;
  variant?: 'ghost' | 'outline' | 'default';
  showLabel?: boolean;
}

export function LanguageSwitcher({ className, variant = 'ghost', showLabel = true }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();

  const currentCode = i18n.language?.startsWith('id')
    ? 'id'
    : i18n.language?.startsWith('en')
    ? 'en'
    : 'zh';

  const toggleLanguage = () => {
    const currentIndex = languages.findIndex((l) => l.code === currentCode);
    const nextIndex = (currentIndex + 1) % languages.length;
    i18n.changeLanguage(languages[nextIndex].code);
  };

  const currentItem = languages.find((l) => l.code === currentCode) || languages[0];

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={toggleLanguage}
      className={cn('justify-center sm:justify-start gap-1.5 sm:gap-2 text-muted-foreground px-2.5 sm:px-3 shrink-0', className)}
      title="Switch Language (中文 / English / Bahasa Indonesia)"
    >
      <Languages className="h-4 w-4 shrink-0" />
      <span className={cn(showLabel ? 'hidden sm:inline' : 'hidden')}>{t(currentItem.labelKey)}</span>
    </Button>
  );
}

