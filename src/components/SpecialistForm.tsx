import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Specialist } from '@/pages/Specialists';

interface SpecialistFormProps {
  open: boolean;
  onClose: () => void;
  specialist?: Specialist | null;
}

export const SpecialistForm = ({ open, onClose, specialist }: SpecialistFormProps) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    specialties: '',
    notes: '',
    active: true,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (specialist) {
      setFormData({
        name: specialist.name,
        email: specialist.email || '',
        phone: specialist.phone || '',
        specialties: specialist.specialties?.join(', ') || '',
        notes: specialist.notes || '',
        active: specialist.active,
      });
    } else {
      setFormData({ name: '', email: '', phone: '', specialties: '', notes: '', active: true });
    }
  }, [specialist]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const dataToSave = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        specialties: formData.specialties
          ? formData.specialties.split(',').map((s) => s.trim()).filter(Boolean)
          : null,
        notes: formData.notes || null,
        active: formData.active,
      };

      if (specialist) {
        const { error } = await supabase
          .from('specialists')
          .update(dataToSave)
          .eq('id', specialist.id);
        if (error) throw error;
        toast({ title: 'Especialista actualizado correctamente' });
      } else {
        const { error } = await supabase
          .from('specialists')
          .insert([{ ...dataToSave, created_by: user.id }]);
        if (error) throw error;
        toast({ title: 'Especialista creado correctamente' });
      }

      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{specialist ? 'Editar Especialista' : 'Nuevo Especialista'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="specialties">Especialidades (separadas por coma)</Label>
            <Input
              id="specialties"
              value={formData.specialties}
              onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
              placeholder="Ej: Desarrollo, Diseño, Marketing"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="active"
              checked={formData.active}
              onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
            />
            <Label htmlFor="active">Activo</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
