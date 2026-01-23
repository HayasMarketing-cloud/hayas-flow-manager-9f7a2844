import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FolderKanban, Loader2 } from 'lucide-react';

interface ContractProjectCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: {
    id: string;
    title: string;
    code?: string;
    client?: { name: string } | null;
  };
  requestsCount: number;
  onCreateProject: () => void;
  isCreating: boolean;
}

export const ContractProjectCreationModal = ({
  isOpen,
  onClose,
  contract,
  requestsCount,
  onCreateProject,
  isCreating,
}: ContractProjectCreationModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-primary" />
            Crear Proyecto Operativo
          </DialogTitle>
          <DialogDescription>
            Se creará un proyecto operativo desde este contrato con milestones automáticos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Contrato:</span>
              <div className="flex items-center gap-2">
                {contract.code && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {contract.code}
                  </Badge>
                )}
                <span className="font-medium">{contract.title}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Cliente:</span>
              <span className="font-medium">{contract.client?.name || 'Sin cliente'}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Solicitudes a vincular:</span>
              <Badge variant="secondary" className="font-mono">
                {requestsCount}
              </Badge>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <p>
              Se generará un proyecto operativo con <strong>{requestsCount}</strong>{' '}
              {requestsCount === 1 ? 'milestone' : 'milestones'} basados en las solicitudes
              financieras del contrato.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Ahora no
          </Button>
          <Button onClick={onCreateProject} disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <FolderKanban className="h-4 w-4 mr-2" />
                Crear Proyecto
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
