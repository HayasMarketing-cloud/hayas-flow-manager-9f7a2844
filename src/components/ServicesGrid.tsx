import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Clock, DollarSign } from 'lucide-react';
import { Service } from '@/pages/Services';

interface ServicesGridProps {
  services: Service[];
  onEdit: (service: Service) => void;
  onDelete: (id: string) => void;
}

export const ServicesGrid = ({ services, onEdit, onDelete }: ServicesGridProps) => {
  if (services.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No hay servicios registrados
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {services.map((service) => (
        <Card key={service.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg">{service.name}</CardTitle>
                {service.category && (
                  <Badge variant="secondary" className="mt-2">
                    {service.category}
                  </Badge>
                )}
              </div>
              <Badge variant={service.active ? 'default' : 'secondary'}>
                {service.active ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            {service.description && (
              <CardDescription className="line-clamp-2">{service.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {service.price && (
                <div className="flex items-center text-sm">
                  <DollarSign className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>${service.price}</span>
                </div>
              )}
              {service.duration_minutes && (
                <div className="flex items-center text-sm">
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{service.duration_minutes} minutos</span>
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onEdit(service)} className="flex-1">
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button variant="outline" size="sm" onClick={() => onDelete(service.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
