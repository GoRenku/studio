import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/ui/alert';

interface GenerationPreviewDiagnosticsBannerProps {
  diagnostics: DiagnosticIssue[];
}

export function GenerationPreviewDiagnosticsBanner({
  diagnostics,
}: GenerationPreviewDiagnosticsBannerProps) {
  if (!diagnostics.length) {
    return null;
  }

  const hasError = diagnostics.some((issue) => issue.severity === 'error');
  const Icon = hasError ? AlertCircle : AlertTriangle;

  return (
    <Alert
      variant={hasError ? 'destructive' : 'default'}
      className='mb-4 shrink-0'
    >
      <Icon />
      <AlertTitle>
        {hasError ? 'Generation Preview Diagnostics' : 'Generation Preview Notes'}
      </AlertTitle>
      <AlertDescription>
        {diagnostics.map((issue, index) => (
          <div key={`${issue.code}:${index}`} className='flex flex-col gap-1'>
            <p>
              <span className='font-medium text-foreground'>{issue.code}</span>
              {': '}
              {issue.message}
            </p>
            {issue.suggestion ? <p>{issue.suggestion}</p> : null}
          </div>
        ))}
      </AlertDescription>
    </Alert>
  );
}
