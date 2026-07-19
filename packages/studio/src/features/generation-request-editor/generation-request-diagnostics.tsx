import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/ui/alert';

export function GenerationRequestDiagnostics({
  diagnostics,
}: {
  diagnostics: DiagnosticIssue[];
}) {
  if (!diagnostics.length) return null;
  return (
    <Alert variant={diagnostics.some((issue) => issue.severity === 'error') ? 'destructive' : 'default'} className='mt-4 mb-4 shrink-0'>
      <AlertTriangle />
      <AlertTitle>Request diagnostics</AlertTitle>
      <AlertDescription>
        <ul className='list-disc space-y-1 pl-4'>
          {diagnostics.map((issue, index) => (
            <li key={`${issue.code}:${index}`}>
              <span className='font-medium'>{issue.code}:</span> {issue.message}
              {issue.suggestion ? (
                <span className='block text-muted-foreground'>
                  {issue.suggestion}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
