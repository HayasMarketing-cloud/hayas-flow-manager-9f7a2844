import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, FolderKanban, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ProjectCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  budget: any;
  onCreateProject: () => void;
}

export const ProjectCreationModal = ({ 
  isOpen, 
  onClose, 
  budget,
  onCreateProject 
}: ProjectCreationModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <DialogTitle>Presupuesto Aprobado</DialogTitle>
          </div>
          <DialogDescription>
            El presupuesto <strong>{budget?.title}</strong> ha sido aprobado exitosamente.
            Las solicitudes financieras han sido generadas automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Cliente:</span>
              <span className="font-medium">{budget?.client?.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Monto Total:</span>
              <span className="font-medium">€{budget?.total_amount?.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Solicitudes creadas:</span>
              <Badge variant="secondary">{budget?.budget_items?.length || 0}</Badge>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-start gap-3">
              <FolderKanban className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1 space-y-1">
                <h4 className="text-sm font-medium">¿Deseas crear un proyecto operativo?</h4>
                <p className="text-sm text-muted-foreground">
                  Puedes crear un proyecto operativo para organizar las tareas, hitos y responsables
                  asociados a este presupuesto.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Ahora No
          </Button>
          <Button onClick={onCreateProject}>
            <FolderKanban className="h-4 w-4 mr-2" />
            Crear Proyecto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
