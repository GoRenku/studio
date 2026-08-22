import { useRef, useState } from 'react';
import type { ProviderCredentialStatus } from '@gorenku/studio-core/client';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';

export interface ProviderCredentialsFieldsProps {
  providers: ProviderCredentialStatus[];
  draftValues: Record<string, string>;
  disabled?: boolean;
  autoFocusFirst?: boolean;
  onValueChange: (provider: string, value: string) => void;
}

export function ProviderCredentialsFields({
  providers,
  draftValues,
  disabled = false,
  autoFocusFirst = false,
  onValueChange,
}: ProviderCredentialsFieldsProps) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const firstMissingProvider = providers.find(
    (provider) => !provider.configured
  )?.provider;

  return (
    <div className='overflow-hidden rounded-xl border border-border/45 bg-card/20 shadow-sm'>
      {providers.map((provider, providerIndex) => {
        const value = draftValues[provider.provider] ?? '';
        const showValue = revealed.has(provider.provider);
        const inputId = `provider-credential-${provider.provider}`;
        const descriptionId = `${inputId}-description`;
        const valueInvalid = Boolean(value) && !isValidValue(value);
        return (
          <section
            key={provider.provider}
            className={`grid grid-cols-[150px_minmax(0,1fr)] items-center gap-6 px-6 py-5 ${
              providerIndex < providers.length - 1
                ? 'border-b border-border/30'
                : ''
            }`}
          >
            <label
              htmlFor={inputId}
              className='text-[15px] font-medium leading-6 text-foreground'
            >
              {provider.label}
            </label>

            <div className='space-y-1.5'>
              <div className='relative'>
                <Input
                  ref={(node) => {
                    inputRefs.current[provider.provider] = node;
                  }}
                  id={inputId}
                  type={showValue ? 'text' : 'password'}
                  autoComplete='new-password'
                  autoFocus={
                    autoFocusFirst &&
                    provider.provider === firstMissingProvider
                  }
                  value={value}
                  disabled={disabled}
                  aria-invalid={valueInvalid}
                  aria-describedby={descriptionId}
                  placeholder={
                    provider.configured ? '••••••••••••••••' : 'Enter API key'
                  }
                  className={`h-12 border-input/80 bg-background/40 px-4 shadow-sm focus-visible:border-primary/80 focus-visible:ring-primary/45 ${
                    provider.configured
                      ? 'placeholder:text-foreground/55'
                      : 'placeholder:text-muted-foreground/70'
                  } ${
                    value ? 'pr-12' : provider.configured ? 'pr-24' : ''
                  }`}
                  onChange={(event) =>
                    onValueChange(provider.provider, event.currentTarget.value)
                  }
                />
                {provider.configured && !value ? (
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    disabled={disabled}
                    className='absolute right-1 top-1/2 h-10 -translate-y-1/2 px-3 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:text-primary'
                    aria-label={`Replace ${provider.label} API key`}
                    onClick={() => inputRefs.current[provider.provider]?.focus()}
                  >
                    Replace
                  </Button>
                ) : value ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        disabled={disabled}
                        className='absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 text-muted-foreground'
                        aria-label={showValue ? 'Hide API key' : 'Show API key'}
                        onClick={() =>
                          setRevealed((current) =>
                            toggleSet(current, provider.provider)
                          )
                        }
                      >
                        {showValue ? (
                          <EyeOff className='h-4 w-4' />
                        ) : (
                          <Eye className='h-4 w-4' />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {showValue ? 'Hide API key' : 'Show API key'}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </div>

              {valueInvalid ? (
                <p
                  id={descriptionId}
                  className='text-xs leading-5 text-destructive'
                >
                  API keys must be a single non-empty line.
                </p>
              ) : (
                <p id={descriptionId} className='sr-only'>
                  {provider.configured
                    ? 'An API key is configured. Choose Replace or enter a new value to replace it when you save.'
                    : 'No API key is configured. Enter an API key for this provider.'}
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function isValidValue(value: string): boolean {
  return Boolean(value.trim()) && !/[\r\n\0]/.test(value);
}

function toggleSet(values: Set<string>, value: string): Set<string> {
  const next = new Set(values);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}
