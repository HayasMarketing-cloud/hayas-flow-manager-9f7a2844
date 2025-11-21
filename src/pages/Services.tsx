import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ServiceForm } from '@/components/ServiceForm';
import { ServicesGrid } from '@/components/ServicesGrid';
import { toast } from '@/hooks/use-toast';

export interface Service {
  id: string;
  name: string;
  description?: string;
  category?: string;
  price?: number;
  duration_minutes?: number;
  active: boolean;
  created_at: string;
}

const Services = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServices(data || []);
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

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;

      toast({
        title: 'Servicio eliminado',
        description: 'El servicio ha sido eliminado correctamente',
      });
      fetchServices();
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
    setEditingService(null);
    fetchServices();
  };

  const filteredServices = services.filter(
    (service) => categoryFilter === 'all' || service.category === categoryFilter
  );

  const categories = ['all', ...Array.from(new Set(services.map((s) => s.category).filter(Boolean)))];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Servicios</h1>
            <p className="text-muted-foreground">Gestiona tus servicios</p>
          </div>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Servicio
          </Button>
        </div>

        <div className="flex gap-2">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={categoryFilter === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoryFilter(cat)}
            >
              {cat === 'all' ? 'Todos' : cat}
            </Button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Servicios</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : (
              <ServicesGrid services={filteredServices} onEdit={handleEdit} onDelete={handleDelete} />
            )}
          </CardContent>
        </Card>

        <ServiceForm
          open={isFormOpen}
          onClose={handleFormClose}
          service={editingService}
        />
      </div>
    </AppLayout>
  );
};

export default Services;
