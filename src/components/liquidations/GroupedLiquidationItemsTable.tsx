import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Trash2, Building2, FolderKanban, FileSpreadsheet, Package } from 'lucide-react';
import { formatCurrency } from '@/lib/liquidation-utils';
import { groupItemsByClientAndProject, GroupedClient, GroupedProjectBudget } from '@/lib/liquidation-grouping';

interface CommissionDetail {
  type: string;
  percentage: number;
  baseAmount: number;
  invoiceCodes: string[];
  clientId?: string;
  clientName?: string;
  budgetId?: string;
  budgetCode?: string;
  budgetTitle?: string;
}

interface GroupedLiquidationItemsTableProps {
  items: any[];
  isEditable?: boolean;
  canEdit?: boolean;
  onRemoveItem?: (item: { id: string; requestId: string | null; description: string }) => void;
  commissionDetails?: Record<string, CommissionDetail>;
}

export function GroupedLiquidationItemsTable({
  items,
  isEditable = false,
  canEdit = false,
  onRemoveItem,
  commissionDetails,
}: GroupedLiquidationItemsTableProps) {
  const navigate = useNavigate();
  const showActions = isEditable && canEdit;

  const groupedItems = useMemo(() => {
    return groupItemsByClientAndProject(items, commissionDetails);
  }, [items, commissionDetails]);

  if (!items || items.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        No hay items en esta liquidación
      </p>
    );
  }

  const renderItemRow = (item: any, isLast: boolean) => {
    const opRequest = item.financial_request?.operational_request?.[0];
    const displayQuantity = item.financial_request?.cost_type === 'hourly'
      ? (item.financial_request?.hours ?? item.quantity)
      : (item.financial_request?.quantity ?? item.quantity);

    return (
      <TableRow
        key={item.id}
        className={`${item.financial_request?.id ? 'cursor-pointer hover:bg-muted/30' : ''} ${!isLast ? 'border-b-0' : ''}`}
        onClick={() => item.financial_request?.id && navigate(`/solicitudes/${item.financial_request.id}`)}
      >
        <TableCell className="font-mono text-sm pl-12">
          {item.financial_request?.id ? (
            <span className="text-primary hover:underline cursor-pointer">
              {item.financial_request?.code}
            </span>
          ) : (
            '-'
          )}
        </TableCell>
        <TableCell className="max-w-[200px]">
          <div className="truncate">{item.description}</div>
          {item.description?.startsWith('Comisión') && (() => {
            // Try to find matching commission detail from linked sales_commissions
            if (commissionDetails) {
              const detail = Object.values(commissionDetails).find(d => {
                const typeLabel = d.type === 'am' ? 'AM' : d.type === 'pm' ? 'PM' : 'Venta';
                return item.description?.includes(`Comisión ${typeLabel}`);
              });
              if (detail) {
                const invoiceLabel = detail.invoiceCodes.length === 1
                  ? `Factura Nº ${detail.invoiceCodes[0]}`
                  : detail.invoiceCodes.length > 1
                    ? `Facturas ${detail.invoiceCodes.join(', ')}`
                    : '';
                return (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {detail.percentage}% sobre {formatCurrency(detail.baseAmount)}
                    {invoiceLabel && !item.description?.includes('Factura') ? ` — ${invoiceLabel}` : ''}
                  </p>
                );
              }
            }
            // Fallback: parse percentage and origin from the description itself
            const descMatch = item.description?.match(/Comisión\s+\w+\s+\((\d+(?:[.,]\d+)?)%\)(?:\s*—\s*(.+))?/);
            if (descMatch) {
              return (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {descMatch[1]}% sobre {formatCurrency(item.total / (parseFloat(descMatch[1].replace(',', '.')) / 100))}
                  {descMatch[2] ? ` — ${descMatch[2]}` : ''}
                </p>
              );
            }
            return null;
          })()}
        </TableCell>
        <TableCell className="text-right tabular-nums">{displayQuantity}</TableCell>
        <TableCell className="text-right tabular-nums">{formatCurrency(item.unit_price)}</TableCell>
        <TableCell className="text-right font-medium tabular-nums">{formatCurrency(item.total)}</TableCell>
        {showActions && (
          <TableCell className="text-right">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveItem?.({
                  id: item.id,
                  requestId: item.financial_request?.id || null,
                  description: item.description,
                });
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TableCell>
        )}
      </TableRow>
    );
  };

  const renderProjectBudgetHeader = (projectGroup: GroupedProjectBudget) => {
    const IconComponent = projectGroup.type === 'project' 
      ? FolderKanban 
      : projectGroup.type === 'budget' 
        ? FileSpreadsheet 
        : Package;

    const colorClass = projectGroup.type === 'project'
      ? 'text-emerald-600 dark:text-emerald-400'
      : projectGroup.type === 'budget'
        ? 'text-primary'
        : 'text-muted-foreground';

    return (
      <TableRow 
        key={`project-${projectGroup.id}`}
        className="bg-muted/30 hover:bg-muted/30 border-b-0"
      >
        <TableCell 
          colSpan={showActions ? 5 : 4} 
          className="font-medium py-2 pl-8"
        >
          <span className={`flex items-center gap-2 ${colorClass}`}>
            <IconComponent className="h-3.5 w-3.5" />
            {projectGroup.name}
          </span>
        </TableCell>
        <TableCell className="text-right font-medium text-muted-foreground tabular-nums py-2">
          {formatCurrency(projectGroup.subtotal)}
        </TableCell>
      </TableRow>
    );
  };

  const renderClientHeader = (clientGroup: GroupedClient) => {
    return (
      <TableRow 
        key={`client-${clientGroup.clientId}`}
        className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <TableCell 
          colSpan={showActions ? 5 : 4} 
          className="font-bold py-3"
        >
          <span className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            {clientGroup.clientName}
          </span>
        </TableCell>
        <TableCell className="text-right font-bold tabular-nums py-3">
          {formatCurrency(clientGroup.subtotal)}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Código</TableHead>
          <TableHead>Descripción</TableHead>
          <TableHead className="text-right">Cant.</TableHead>
          <TableHead className="text-right">Precio Unit.</TableHead>
          <TableHead className="text-right">Total</TableHead>
          {showActions && <TableHead className="w-10"></TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {groupedItems.map((clientGroup) => (
          <>
            {renderClientHeader(clientGroup)}
            {clientGroup.projectBudgets.map((projectGroup) => (
              <>
                {renderProjectBudgetHeader(projectGroup)}
                {projectGroup.items.map((item, idx) => 
                  renderItemRow(item, idx === projectGroup.items.length - 1)
                )}
              </>
            ))}
          </>
        ))}
      </TableBody>
    </Table>
  );
}
