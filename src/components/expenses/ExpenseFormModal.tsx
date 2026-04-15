import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Expense } from '@/hooks/useExpenses';

const CATEGORIES = ['software', 'oficina', 'servicios', 'seguros', 'telecomunicaciones', 'marketing', 'otros'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense | null;
  onSave: (data: any) => void;
}

export function ExpenseFormModal({ open, onOpenChange, expense, onSave }: Props) {
  const [form, setForm] = useState({
    name: '',
    category: 'software',
    is_active: true,
    periodicity: 'monthly',
    monthly_cost: 0,
    renewal_month: '',
    account_email: '',
    website_url: '',
    notes: '',
  });

  useEffect(() => {
    if (expense) {
      setForm({
        name: expense.name,
        category: expense.category,
        is_active: expense.is_active,
        periodicity: expense.periodicity,
        monthly_cost: expense.monthly_cost,
        renewal_month: expense.renewal_month || '',
        account_email: expense.account_email || '',
        website_url: expense.website_url || '',
        notes: expense.notes || '',
      });
    } else {
      setForm({ name: '', category: 'software', is_active: true, periodicity: 'monthly', monthly_cost: 0, renewal_month: '', account_email: '', website_url: '', notes: '' });
    }
  }, [expense, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...form, monthly_cost: Number(form.monthly_cost) });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{expense ? 'Editar Gasto' : 'Nuevo Gasto'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nombre</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <Label>Categoría</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Periodicidad</Label>
              <Select value={form.periodicity} onValueChange={v => setForm(f => ({ ...f, periodicity: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensual</SelectItem>
                  <SelectItem value="annual">Anual</SelectItem>
                  <SelectItem value="quarterly">Trimestral</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Coste mensual (€)</Label>
              <Input type="number" step="0.01" value={form.monthly_cost} onChange={e => setForm(f => ({ ...f, monthly_cost: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label>Mes renovación</Label>
              <Input value={form.renewal_month} onChange={e => setForm(f => ({ ...f, renewal_month: e.target.value }))} placeholder="Ej: Febrero" />
            </div>
            <div>
              <Label>Email cuenta</Label>
              <Input type="email" value={form.account_email} onChange={e => setForm(f => ({ ...f, account_email: e.target.value }))} />
            </div>
            <div>
              <Label>Web</Label>
              <Input value={form.website_url} onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label>Notas / Para qué sirve</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>Activo</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">{expense ? 'Guardar' : 'Crear'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
