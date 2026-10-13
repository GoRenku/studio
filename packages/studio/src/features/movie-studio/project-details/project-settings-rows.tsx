import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Switch } from '@/ui/switch';

export function SettingsSwitchRow({ id, label, description, checked, onCheckedChange, last = false }: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-6 py-3 ${last ? '' : 'border-b border-border/35'}`}>
      <div className='min-w-0'><p id={`${id}-label`} className='text-sm font-medium text-foreground'>{label}</p><p id={`${id}-description`} className='mt-1 text-xs leading-4 text-muted-foreground'>{description}</p></div>
      <Switch aria-labelledby={`${id}-label`} aria-describedby={`${id}-description`} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function SettingsSelectRow<Value extends string>({ id, label, description, value, options, disabled = false, onValueChange }: {
  id: string;
  label: string;
  description: string;
  value: Value;
  options: Array<{ value: Value; label: string }>;
  disabled?: boolean;
  onValueChange: (value: Value) => void;
}) {
  return (
    <div className='flex items-center justify-between gap-6 border-b border-border/35 py-3'>
      <div className='min-w-0'><p id={`${id}-label`} className='text-sm font-medium text-foreground'>{label}</p><p id={`${id}-description`} className='mt-1 text-xs leading-4 text-muted-foreground'>{description}</p></div>
      <Select value={value} onValueChange={(next) => onValueChange(next as Value)} disabled={disabled}>
        <SelectTrigger size='sm' className='w-44' aria-labelledby={`${id}-label`} aria-describedby={`${id}-description`}><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
