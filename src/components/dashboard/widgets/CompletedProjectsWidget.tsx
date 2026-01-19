import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, ExternalLink, FileText, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCompletedProjectsPendingInvoice, CompletedProject } from '@/hooks/useCompletedProjectsPendingInvoice';
import { formatCurrency } from '@/lib/request-utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

function ProjectItem({ project }: { project: CompletedProject }) {
  const navigate = useNavigate();

  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
          <span className="font-medium text-sm truncate">{project.name}</span>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Building2 className="h-3 w-3" />
          <span className="truncate">{project.client.name}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {project.budget && (
            <Badge variant="outline" className="text-xs">
              <FileText className="h-3 w-3 mr-1" />
              {project.budget.code}
            </Badge>
          )}
          {project.requests_count > 0 && (
            <Badge variant="secondary" className="text-xs">
              {project.requests_count} solicitudes pendientes
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-2">
        <span className="font-semibold text-sm text-primary">
          {formatCurrency(project.total_amount)}
        </span>
        {project.completed_at && (
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(project.completed_at), { addSuffix: true, locale: es })}
          </span>
        )}
        <Button 
          size="sm" 
          variant="ghost" 
          className="h-7 px-2"
          onClick={() => navigate(`/operaciones/proyectos/${project.id}`)}
        >
          <ExternalLink className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function WidgetSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-3 rounded-lg border">
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2 mb-2" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

export function CompletedProjectsWidget() {
  const { data: projects, isLoading, error } = useCompletedProjectsPendingInvoice();
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Proyectos Completados - Pendientes de Facturar
          </CardTitle>
          {projects && projects.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              {projects.length}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <WidgetSkeleton />
        ) : error ? (
          <p className="text-sm text-destructive">Error al cargar proyectos</p>
        ) : projects && projects.length > 0 ? (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {projects.map((project) => (
              <ProjectItem key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay proyectos pendientes de facturar</p>
          </div>
        )}

        {projects && projects.length > 0 && (
          <div className="mt-4 pt-3 border-t">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => navigate('/facturas')}
            >
              Ir a Facturas
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
