import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Mail, Phone } from 'lucide-react';
import { Specialist } from '@/pages/Specialists';

interface SpecialistsGridProps {
  specialists: Specialist[];
  onEdit: (specialist: Specialist) => void;
  onDelete: (id: string) => void;
}

export const SpecialistsGrid = ({ specialists, onEdit, onDelete }: SpecialistsGridProps) => {
  if (specialists.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No hay especialistas registrados
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {specialists.map((specialist) => (
        <Card key={specialist.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg">{specialist.name}</CardTitle>
              </div>
              <Badge variant={specialist.active ? 'default' : 'secondary'}>
                {specialist.active ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            {specialist.specialties && specialist.specialties.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {specialist.specialties.map((specialty, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {specialty}
                  </Badge>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {specialist.email && (
                <div className="flex items-center text-sm">
                  <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{specialist.email}</span>
                </div>
              )}
              {specialist.phone && (
                <div className="flex items-center text-sm">
                  <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{specialist.phone}</span>
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onEdit(specialist)} className="flex-1">
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button variant="outline" size="sm" onClick={() => onDelete(specialist.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
