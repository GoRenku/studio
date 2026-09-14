import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog';
import { Input } from '@/ui/input';

interface InspirationFolderCreateDialogProps {
  onCreate: (name: string) => Promise<void>;
  trigger?: 'full' | 'compact';
}

export function InspirationFolderCreateDialog({
  onCreate,
  trigger = 'full',
}: InspirationFolderCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await onCreate(name);
      setName('');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger === 'compact' ? (
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='gap-2'
          >
            <Plus className='h-3.5 w-3.5' />
            New Folder
          </Button>
        ) : (
          <Button type='button' variant='outline' size='sm' className='w-full gap-2'>
            <Plus className='h-3.5 w-3.5' />
            New Folder
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className='max-w-md p-0'>
        <DialogHeader>
          <DialogTitle>Create Inspiration Folder</DialogTitle>
          <DialogDescription>
            Use a reference name such as a movie, director, or cinematographer.
          </DialogDescription>
        </DialogHeader>
        <div className='px-6 py-2'>
          <Input
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            placeholder='Blade Runner 2049'
          />
        </div>
        <DialogFooter>
          <Button type='button' variant='ghost' onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type='button' disabled={saving || !name.trim()} onClick={submit}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
