import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Briefcase, Edit, Trash2, Eye, MoreVertical } from 'lucide-react';
import { useOperationalProjects, useDeleteOperationalProject } from '@/hooks/useOperationalProjects';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OperationalProjectFormModal } from '@/components/operations/OperationalProjectFormModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import GoogleDriveIcon from '@/assets/icons8-google-drive.svg';

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
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('create');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<any>(null);

  const { data: projects, isLoading } = useOperationalProjects({
    clientId: clientFilter === 'all' ? undefined : clientFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
    searchTerm: searchTerm || undefined,
  });

  const deleteMutation = useDeleteOperationalProject();

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

  // Fetch request counts for all projects
  const { data: requestCounts } = useQuery({
    queryKey: ['operational-request-counts', projects?.map(p => p.id)],
    queryFn: async () => {
      if (!projects || projects.length === 0) return {};
      const { data, error } = await supabase
        .from('operational_requests')
        .select('id, operational_project_id')
        .in('operational_project_id', projects.map(p => p.id));
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data?.forEach(r => {
        counts[r.operational_project_id] = (counts[r.operational_project_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!projects && projects.length > 0,
  });

  const hasActiveFilters = searchTerm || clientFilter !== 'all' || statusFilter !== 'all';

  const handleCreate = () => {
    setSelectedProject(null);
    setModalMode('create');
    setModalOpen(true);
  };

  const handleEdit = (project: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProject(project);
    setModalMode('edit');
    setModalOpen(true);
  };

  const handleDelete = (project: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (projectToDelete) {
      await deleteMutation.mutateAsync(projectToDelete.id);
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  const handleViewDetail = (projectId: string) => {
    navigate(`/operaciones/proyectos/${projectId}`);
  };

  return (
    <AppLayout 
      title="Proyectos Operativos" 
      description="Gestión de proyectos operativos por cliente"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Proyectos Operativos</h2>
          <Button onClick={handleCreate}>
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
                    onClick: handleCreate,
                    icon: Plus,
                  }
                : undefined
            }
          />
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const reqCount = requestCounts?.[project.id] || 0;
              return (
                <Card 
                  key={project.id} 
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleViewDetail(project.id)}
                >
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1">{project.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {project.client?.name}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={statusColors[project.status as keyof typeof statusColors]}>
                            {statusLabels[project.status as keyof typeof statusLabels]}
                          </Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewDetail(project.id); }}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver Detalle
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => handleEdit(project, e)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => handleDelete(project, e)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
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
                        <Badge variant="outline">
                          {reqCount} solicitudes
                        </Badge>
                      </div>

                      {project.deadline && (
                        <div className="text-sm text-muted-foreground">
                          Deadline: {new Date(project.deadline).toLocaleDateString('es-ES')}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {project.client?.hub_client_url && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <a href={project.client.hub_client_url} target="_blank" rel="noopener noreferrer">
                              HUB Cliente
                            </a>
                          </Button>
                        )}
                        {project.hub_project_url && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <a href={project.hub_project_url} target="_blank" rel="noopener noreferrer">
                              HUB Proyecto
                            </a>
                          </Button>
                        )}
                        {project.drive_folder_url && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(project.drive_folder_url, '_blank');
                            }}
                          >
                            <img src={GoogleDriveIcon} alt="Drive" className="h-4 w-4 mr-2" />
                            Project DRIVE
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <OperationalProjectFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialData={selectedProject}
        mode={modalMode}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proyecto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el proyecto "{projectToDelete?.name}" y no se puede deshacer.
              Las solicitudes operativas asociadas también serán eliminadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
