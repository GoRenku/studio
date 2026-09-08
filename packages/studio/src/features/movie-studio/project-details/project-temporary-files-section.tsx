import { useState } from 'react';
import { cleanProjectTemporaryFiles } from '@/services/studio-projects-api';
import { Button } from '@/ui/button';
import { DeleteConfirmDialog } from '@/ui/delete-confirm-dialog';

export function ProjectTemporaryFilesSection({ projectName }: { projectName: string }) {
  const [result, setResult] = useState<string | null>(null);
  return (
    <section className='border-t border-border py-6'>
      <h3 className='text-sm font-medium'>Temporary files</h3>
      <div className='mt-4 flex items-center justify-between gap-6'>
        <p className='text-sm text-muted-foreground'>Clear cached render frames and other temporary working files.</p>
        <DeleteConfirmDialog
          title='Clean up temporary files?'
          message='This permanently removes temporary working files, including cached render frames. Later work may need to regenerate them. Saved media and previs sources are kept.'
          deleteLabel='Clean up'
          trigger={<Button type='button' variant='outline'>Clean up temporary files</Button>}
          onDelete={async () => {
            const report = await cleanProjectTemporaryFiles(projectName);
            setResult(report.removedFiles === 0
              ? 'No temporary files to remove.'
              : `Removed ${report.removedFiles} temporary files (${(report.removedBytes / 1024 / 1024).toFixed(1)} MB).`);
          }}
        />
      </div>
      {result ? <p role='status' className='mt-3 text-sm text-muted-foreground'>{result}</p> : null}
    </section>
  );
}
