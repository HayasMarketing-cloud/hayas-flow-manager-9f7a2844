import { useState } from 'react';
import { Check, AlertTriangle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/invoice-utils';
import { Database } from '@/integrations/supabase/types';

type InvoiceStatus = Database['public']['Enums']['invoice_status'];

export interface ExtractedInvoice {
  id: string;
  fileName: string;
  pdfBase64: string;
  status: 'processing' | 'success' | 'error';
  error?: string;
  data?: {
    invoice_code: string;
    client_name: string;
    client_id: string | null;
    client_matched: boolean;
    invoice_date: string;
    due_date: string | null;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    total_amount: number;
    line_items?: Array<{
      description: string;
      quantity: number;
      unit_price: number;
    }>;
  };
  // Editable fields
  editedCode?: string;
  editedClientId?: string;
  editedSubtotal?: number;
  editedTaxRate?: number;
  editedInvoiceStatus?: InvoiceStatus;
  editedContractId?: string | null;
  editedBudgetId?: string | null;
  editedProjectId?: string | null;
}

interface Client {
  id: string;
  name: string;
}

interface Contract {
  id: string;
  title: string;
  code: string;
  client_id: string;
}

interface Budget {
  id: string;
  title: string;
  code: string;
  client_id: string;
}

interface Project {
  id: string;
  name: string;
  client_id: string;
}

interface ExtractedInvoiceRowProps {
  invoice: ExtractedInvoice;
  clients: Client[];
  contracts: Contract[];
  budgets: Budget[];
  projects: Project[];
  onUpdate: (id: string, updates: Partial<ExtractedInvoice>) => void;
  onRemove: (id: string) => void;
}

export function ExtractedInvoiceRow({
  invoice,
  clients,
  contracts,
  budgets,
  projects,
  onUpdate,
  onRemove,
}: ExtractedInvoiceRowProps) {
  const [expanded, setExpanded] = useState(false);

  if (invoice.status === 'processing') {
    return (
      <tr className="animate-pulse">
        <td colSpan={11} className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-muted-foreground">
              Procesando {invoice.fileName}...
            </span>
          </div>
        </td>
      </tr>
    );
  }

  if (invoice.status === 'error') {
    return (
      <tr className="bg-destructive/5">
        <td colSpan={11} className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <X className="h-4 w-4 text-destructive" />
              <span className="text-destructive">
                {invoice.fileName}: {invoice.error || 'Error al procesar'}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(invoice.id)}
            >
              Eliminar
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  const data = invoice.data!;
  const clientId = invoice.editedClientId ?? data.client_id;
  const code = invoice.editedCode ?? data.invoice_code;
  const subtotal = invoice.editedSubtotal ?? data.subtotal;
  const taxRate = invoice.editedTaxRate ?? data.tax_rate;
  const invoiceStatus = invoice.editedInvoiceStatus ?? 'sent';
  const contractId = invoice.editedContractId ?? null;
  const budgetId = invoice.editedBudgetId ?? null;
  const projectId = invoice.editedProjectId ?? null;

  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const isClientMissing = !clientId;

  // Filter options by selected client
  const clientContracts = clientId 
    ? contracts.filter((c) => c.client_id === clientId) 
    : [];
  const clientBudgets = clientId 
    ? budgets.filter((b) => b.client_id === clientId) 
    : [];
  const clientProjects = clientId 
    ? projects.filter((p) => p.client_id === clientId) 
    : [];

  return (
    <>
      <tr className={isClientMissing ? 'bg-amber-50 dark:bg-amber-950/20' : ''}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {data.client_matched ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : isClientMissing ? (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            ) : (
              <Check className="h-4 w-4 text-blue-500" />
            )}
            <Input
              value={code}
              onChange={(e) =>
                onUpdate(invoice.id, { editedCode: e.target.value })
              }
              className="h-8 w-32"
            />
          </div>
        </td>
        <td className="px-4 py-3">
          <Select
            value={clientId || ''}
            onValueChange={(value) =>
              onUpdate(invoice.id, { editedClientId: value })
            }
          >
            <SelectTrigger className={`h-8 w-48 ${isClientMissing ? 'border-amber-500' : ''}`}>
              <SelectValue placeholder="Seleccionar cliente">
                {clientId
                  ? clients.find((c) => c.id === clientId)?.name || 'Cliente no encontrado'
                  : 'Seleccionar cliente'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {data.client_name && !data.client_matched && (
            <p className="mt-1 text-xs text-muted-foreground">
              Detectado: "{data.client_name}"
            </p>
          )}
        </td>
        <td className="px-4 py-3">
          <Select
            value={contractId || 'none'}
            onValueChange={(value) =>
              onUpdate(invoice.id, { editedContractId: value === 'none' ? null : value })
            }
            disabled={!clientId}
          >
            <SelectTrigger className="h-8 w-36">
              <SelectValue placeholder="Ninguno">
                {contractId
                  ? clientContracts.find((c) => c.id === contractId)?.title || 'Contrato'
                  : 'Ninguno'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ninguno</SelectItem>
              {clientContracts.map((contract) => (
                <SelectItem key={contract.id} value={contract.id}>
                  {contract.code} - {contract.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {clientContracts.length === 1 && contractId === clientContracts[0].id && (
            <p className="mt-1 text-xs text-green-600">✓ sugerido</p>
          )}
        </td>
        <td className="px-4 py-3">
          <Select
            value={budgetId || 'none'}
            onValueChange={(value) =>
              onUpdate(invoice.id, { editedBudgetId: value === 'none' ? null : value })
            }
            disabled={!clientId}
          >
            <SelectTrigger className="h-8 w-36">
              <SelectValue placeholder="Ninguno">
                {budgetId
                  ? clientBudgets.find((b) => b.id === budgetId)?.code || 'Presupuesto'
                  : 'Ninguno'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ninguno</SelectItem>
              {clientBudgets.map((budget) => (
                <SelectItem key={budget.id} value={budget.id}>
                  {budget.code} - {budget.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {clientBudgets.length === 1 && budgetId === clientBudgets[0].id && (
            <p className="mt-1 text-xs text-green-600">✓ sugerido</p>
          )}
        </td>
        <td className="px-4 py-3">
          <Select
            value={projectId || 'none'}
            onValueChange={(value) =>
              onUpdate(invoice.id, { editedProjectId: value === 'none' ? null : value })
            }
            disabled={!clientId}
          >
            <SelectTrigger className="h-8 w-36">
              <SelectValue placeholder="Ninguno">
                {projectId
                  ? clientProjects.find((p) => p.id === projectId)?.name || 'Proyecto'
                  : 'Ninguno'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ninguno</SelectItem>
              {clientProjects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {clientProjects.length === 1 && projectId === clientProjects[0].id && (
            <p className="mt-1 text-xs text-green-600">✓ sugerido</p>
          )}
        </td>
        <td className="px-4 py-3 text-sm">
          {data.invoice_date
            ? new Date(data.invoice_date).toLocaleDateString('es-ES')
            : '-'}
        </td>
        <td className="px-4 py-3">
          <Input
            type="number"
            value={subtotal}
            onChange={(e) =>
              onUpdate(invoice.id, { editedSubtotal: parseFloat(e.target.value) || 0 })
            }
            className="h-8 w-24 text-right"
            step="0.01"
          />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={taxRate}
              onChange={(e) =>
                onUpdate(invoice.id, { editedTaxRate: parseFloat(e.target.value) || 0 })
              }
              className="h-8 w-16 text-right"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </td>
        <td className="px-4 py-3 text-right font-medium">
          {formatCurrency(total)}
        </td>
        <td className="px-4 py-3">
          <Select
            value={invoiceStatus}
            onValueChange={(value) =>
              onUpdate(invoice.id, { editedInvoiceStatus: value as InvoiceStatus })
            }
          >
            <SelectTrigger className="h-8 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="sent">Enviada</SelectItem>
              <SelectItem value="paid">Pagada</SelectItem>
              <SelectItem value="overdue">Vencida</SelectItem>
            </SelectContent>
          </Select>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onRemove(invoice.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </td>
      </tr>
      {expanded && data.line_items && data.line_items.length > 0 && (
        <tr className="bg-muted/30">
          <td colSpan={11} className="px-4 py-3">
            <div className="ml-8">
              <p className="mb-2 text-sm font-medium">Líneas de factura:</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {data.line_items.map((item, idx) => (
                  <li key={idx}>
                    • {item.description} - {item.quantity} x{' '}
                    {formatCurrency(item.unit_price)}
                  </li>
                ))}
              </ul>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
