import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  requestId: string;
  specialistId: string | null;
  specialistName?: string | null;
  disabled?: boolean;
  onRefresh?: () => void;
  compact?: boolean;
}

export const InlineSpecialistPicker = ({
  requestId,
  specialistId,
  specialistName,
  disabled,
  onRefresh,
  compact,
}: Props) => {
  const [open, setOpen] = useState(false);

  const { data: activeSpecialists = [] } = useQuery({
    queryKey: ['active-specialists-lite'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('specialists')
        .select('id, name')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !disabled,
    staleTime: 5 * 60 * 1000,
  });

  const update = async (newId: string | null) => {
    setOpen(false);
    if (newId === specialistId) return;
    const { error } = await supabase
      .from('financial_requests')
      .update({ specialist_id: newId } as any)
      .eq('id', requestId);
    if (error) {
      toast.error('Error al actualizar especialista');
      return;
    }
    toast.success('Especialista actualizado');
    onRefresh?.();
  };

  if (disabled) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <User className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">{specialistName || '-'}</span>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-1.5 rounded px-1 py-0.5 text-sm hover:bg-muted/50 hover:text-foreground transition-colors ${specialistName ? 'text-foreground' : 'text-muted-foreground italic'} ${compact ? 'max-w-[140px]' : 'w-full text-left'}`}
        >
          <User className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{specialistName || '+ Asignar'}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar especialista..." />
          <CommandList>
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__none__" onSelect={() => update(null)}>
                <span className="italic text-muted-foreground">Sin especialista</span>
              </CommandItem>
              {activeSpecialists.map((s) => (
                <CommandItem key={s.id} value={s.name} onSelect={() => update(s.id)}>
                  {s.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
