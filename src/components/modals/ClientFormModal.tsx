import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SimplifiedClientForm } from '@/components/forms/SimplifiedClientForm';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ClientFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: any;
  onSuccess: () => void;
}

export const ClientFormModal = ({
  open,
  onOpenChange,
  initialData,
  onSuccess,
}: ClientFormModalProps) => {
  const handleSuccess = () => {
    onSuccess();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {initialData ? 'Editar Cliente' : 'Nuevo Cliente'}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-8rem)]">
          <div className="px-1 py-1">
            <SimplifiedClientForm
              initialData={initialData}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
