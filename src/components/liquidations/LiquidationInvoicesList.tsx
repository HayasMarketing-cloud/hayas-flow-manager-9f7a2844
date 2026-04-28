import { FileText, ExternalLink, Trash2, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/liquidation-utils';

export interface LiquidationInvoiceRow {
  id: string;
  file_url: string;
  file_name: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  subtotal: number | null;
  tax_amount?: number | null;
  irpf_amount?: number | null;
  total_amount: number | null;
  uploaded_at: string;
}

interface LiquidationInvoicesListProps {
  invoices: LiquidationInvoiceRow[];
  liquidationSubtotal: number;
  onDelete?: (invoiceId: string) => void;
  deletingId?: string | null;
  showDelete?: boolean;
}

export function LiquidationInvoicesList({
  invoices,
  liquidationSubtotal,
  onDelete,
  deletingId,
  showDelete = true,
}: LiquidationInvoicesListProps) {
  const sumOfBases = invoices.reduce(
    (acc, inv) => acc + (Number(inv.subtotal) || 0),
    0,
  );
  const matches = Math.abs(sumOfBases - liquidationSubtotal) <= 1;
  const hasAnyBase = invoices.some((i) => i.subtotal != null);

  if (invoices.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {invoices.map((inv) => {
          const viewUrl = inv.file_url.includes('?')
            ? inv.file_url
            : `${inv.file_url}?t=${Date.now()}`;
          return (
            <div
              key={inv.id}
              className="flex items-center justify-between gap-3 p-3 bg-muted rounded-lg"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <FileText className="h-5 w-5 text-cyan-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {inv.file_name || 'factura.pdf'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {inv.invoice_number ? `Nº ${inv.invoice_number} · ` : ''}
                    {inv.subtotal != null
                      ? `Base ${formatCurrency(Number(inv.subtotal))}`
                      : 'Sin importe extraído'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" asChild>
                  <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Ver
                  </a>
                </Button>
                {showDelete && onDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(inv.id)}
                    disabled={deletingId === inv.id}
                    className="text-destructive hover:text-destructive"
                  >
                    {deletingId === inv.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hasAnyBase && (
        <div
          className={cn(
            'rounded-lg p-3 flex items-start gap-3 text-sm',
            matches
              ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900'
              : 'bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900',
          )}
        >
          {matches ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="font-medium">
              {matches ? 'Importes verificados ✓' : 'Discrepancia de importes'}
            </p>
            <p className="text-muted-foreground mt-0.5">
              Suma de bases: {formatCurrency(sumOfBases)} ·{' '}
              Subtotal liquidación: {formatCurrency(liquidationSubtotal)}
            </p>
            {!matches && (
              <p className="text-muted-foreground mt-0.5">
                Diferencia: {formatCurrency(sumOfBases - liquidationSubtotal)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
