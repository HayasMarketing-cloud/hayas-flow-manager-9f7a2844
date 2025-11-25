import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Briefcase } from 'lucide-react';
import { useOperationalProjects } from '@/hooks/useOperationalProjects';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const statusColors = {
  pending: 'bg-yellow-500',
  in_progress: 'bg-blue-500',
  in_review: 'bg-purple-500',
  completed: 'bg-green-500',
};

const statusLabels = {
  pending: 'Pendiente',
  in_progress: 'En Progreso',
  in_review: 'En Revisión',
  completed: 'Completado',
};

export default function OperationalProjects() {
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: projects, isLoading } = useOperationalProjects({
    clientId: clientFilter === 'all' ? undefined : clientFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
    searchTerm: searchTerm || undefined,
  });

  const { data: clients } = useQuery({
    queryKey: ['clients-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const hasActiveFilters = searchTerm || clientFilter !== 'all' || statusFilter !== 'all';

  return (
    <AppLayout 
      title="Proyectos Operativos" 
      description="Gestión de proyectos operativos por cliente"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Proyectos Operativos</h2>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Proyecto
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar proyectos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los clientes</SelectItem>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="in_progress">En Progreso</SelectItem>
                  <SelectItem value="in_review">En Revisión</SelectItem>
                  <SelectItem value="completed">Completado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Projects Grid */}
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : !projects || projects.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={hasActiveFilters ? 'No se encontraron proyectos' : 'No hay proyectos operativos'}
            description={
              hasActiveFilters
                ? 'Intenta ajustar los filtros de búsqueda'
                : 'Los proyectos operativos te permiten organizar el trabajo por cliente'
            }
            action={
              !hasActiveFilters
                ? {
                    label: 'Crear Proyecto',
                    onClick: () => {},
                    icon: Plus,
                  }
                : undefined
            }
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1">{project.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {project.client?.name}
                        </p>
                      </div>
                      <Badge className={statusColors[project.status as keyof typeof statusColors]}>
                        {statusLabels[project.status as keyof typeof statusLabels]}
                      </Badge>
                    </div>

                    {project.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {project.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Owner: {project.owner?.full_name || '-'}
                      </span>
                      {project.deadline && (
                        <span className="text-muted-foreground">
                          {new Date(project.deadline).toLocaleDateString('es-ES')}
                        </span>
                      )}
                    </div>

                    {project.hub_project_url && (
                      <Button variant="outline" size="sm" className="w-full" asChild>
                        <a href={project.hub_project_url} target="_blank" rel="noopener noreferrer">
                          Ver en HUB
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
