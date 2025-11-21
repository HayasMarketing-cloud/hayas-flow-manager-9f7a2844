import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SpecialistForm } from '@/components/SpecialistForm';
import { SpecialistsGrid } from '@/components/SpecialistsGrid';
import { toast } from '@/hooks/use-toast';

export interface Specialist {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  specialties?: string[];
  notes?: string;
  active: boolean;
  created_at: string;
}

const Specialists = () => {
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSpecialist, setEditingSpecialist] = useState<Specialist | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSpecialists();
  }, []);

  const fetchSpecialists = async () => {
    try {
      const { data, error } = await supabase
        .from('specialists')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSpecialists(data || []);
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

  const handleEdit = (specialist: Specialist) => {
    setEditingSpecialist(specialist);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('specialists').delete().eq('id', id);
      if (error) throw error;

      toast({
        title: 'Especialista eliminado',
        description: 'El especialista ha sido eliminado correctamente',
      });
      fetchSpecialists();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingSpecialist(null);
    fetchSpecialists();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Especialistas</h1>
            <p className="text-muted-foreground">Gestiona tus especialistas</p>
          </div>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Especialista
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Especialistas</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : (
              <SpecialistsGrid specialists={specialists} onEdit={handleEdit} onDelete={handleDelete} />
            )}
          </CardContent>
        </Card>

        <SpecialistForm
          open={isFormOpen}
          onClose={handleFormClose}
          specialist={editingSpecialist}
        />
      </div>
    </AppLayout>
  );
};

export default Specialists;
