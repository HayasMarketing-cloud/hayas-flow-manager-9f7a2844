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
import { Badge } from '@/components/ui/badge';
import { Building2, FileText, FolderKanban } from 'lucide-react';

interface RequestProjectCreationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading: boolean;
  requestData: {
    code: string;
    title: string;
    clientName?: string;
    serviceName?: string;
  };
}

export const RequestProjectCreationModal = ({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  requestData,
}: RequestProjectCreationModalProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-primary" />
            Crear Proyecto Operativo
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-4">
            <p>
              Se creará un nuevo proyecto operativo con un milestone basado en esta solicitud financiera.
            </p>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Solicitud</p>
                  <p className="text-sm">
                    <Badge variant="outline" className="mr-2">{requestData.code}</Badge>
                    {requestData.title}
                  </p>
                </div>
              </div>

              {requestData.clientName && (
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Cliente</p>
                    <p className="text-sm">{requestData.clientName}</p>
                  </div>
                </div>
              )}

              {requestData.serviceName && (
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Servicio</p>
                    <p className="text-sm">{requestData.serviceName}</p>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  Se creará <span className="font-medium text-foreground">1 milestone</span> vinculado a esta solicitud.
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Ahora No</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Creando...' : 'Crear Proyecto'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
