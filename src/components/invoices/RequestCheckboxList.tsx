import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/invoice-utils';
import { AvailableRequest } from '@/hooks/useAvailableRequestsForReconciliation';
import { FolderKanban, FileSpreadsheet, ScrollText } from 'lucide-react';

interface RequestCheckboxListProps {
  requests: AvailableRequest[];
  selectedIds: string[];
  onSelect: (requestId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
}

export function RequestCheckboxList({
  requests,
  selectedIds,
  onSelect,
  onSelectAll,
}: RequestCheckboxListProps) {
  const allSelected = requests.length > 0 && selectedIds.length === requests.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < requests.length;

  const getProjectName = (request: AvailableRequest): string | null => {
    const opRequest = request.operational_request?.[0];
    return opRequest?.operational_project?.name || null;
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                ref={(el) => {
                  if (el) {
                    (el as any).indeterminate = someSelected;
                  }
                }}
                onCheckedChange={(checked) => onSelectAll(!!checked)}
              />
            </TableHead>
            <TableHead>Código</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Origen</TableHead>
            <TableHead>Completada</TableHead>
            <TableHead className="text-right">Importe</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => {
            const isSelected = selectedIds.includes(request.id);
            const projectName = getProjectName(request);
            
            return (
              <TableRow
                key={request.id}
                className={isSelected ? 'bg-primary/5' : undefined}
              >
                <TableCell>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => onSelect(request.id, !!checked)}
                  />
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {request.code}
                </TableCell>
                <TableCell>
                  <div className="max-w-[200px]">
                    <p className="truncate font-medium">{request.title}</p>
                    {request.service && (
                      <p className="text-xs text-muted-foreground truncate">
                        {request.service.name}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {projectName && (
                      <Badge variant="outline" className="w-fit text-xs">
                        <FolderKanban className="h-3 w-3 mr-1" />
                        {projectName}
                      </Badge>
                    )}
                    {request.budget && (
                      <Badge variant="secondary" className="w-fit text-xs">
                        <FileSpreadsheet className="h-3 w-3 mr-1" />
                        {request.budget.code}
                      </Badge>
                    )}
                    {request.contract && (
                      <Badge variant="secondary" className="w-fit text-xs">
                        <ScrollText className="h-3 w-3 mr-1" />
                        {request.contract.code}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {request.completed_at
                    ? format(new Date(request.completed_at), 'd MMM yyyy', { locale: es })
                    : '-'}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(request.sale_amount || 0)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
