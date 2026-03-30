import { useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { Upload, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ExtractedInvoiceRow, ExtractedInvoice } from './ExtractedInvoiceRow';

interface InvoiceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type UploadPhase = 'upload' | 'processing' | 'review';

export function InvoiceUploadModal({ isOpen, onClose }: InvoiceUploadModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [phase, setPhase] = useState<UploadPhase>('upload');
  const [extractedInvoices, setExtractedInvoices] = useState<ExtractedInvoice[]>([]);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Fetch active clients for matching
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch active contracts for association
  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts-active-for-import'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('id, title, code, client_id')
        .eq('status', 'active')
        .order('title');
      if (error) throw error;
      return data;
    },
  });

  // Fetch approved budgets for association
  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets-approved-for-import'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budgets')
        .select('id, title, code, client_id')
        .eq('status', 'approved')
        .order('title');
      if (error) throw error;
      return data;
    },
  });

  // Fetch active operational projects for association
  const { data: projects = [] } = useQuery({
    queryKey: ['projects-active-for-import'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operational_projects')
        .select('id, name, client_id')
        .neq('status', 'completed')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Auto-suggest contract/budget/project when client changes
  useEffect(() => {
    setExtractedInvoices((prev) =>
      prev.map((inv) => {
        if (inv.status !== 'success' || !inv.data) return inv;
        
        const clientId = inv.editedClientId ?? inv.data.client_id;
        if (!clientId) return inv;

        // Only auto-suggest if not already edited
        let updates: Partial<ExtractedInvoice> = {};

        // Auto-suggest contract if single active contract for client
        if (inv.editedContractId === undefined) {
          const clientContracts = contracts.filter((c) => c.client_id === clientId);
          if (clientContracts.length === 1) {
            updates.editedContractId = clientContracts[0].id;
          }
        }

        // Auto-suggest budget if single approved budget for client
        if (inv.editedBudgetId === undefined) {
          const clientBudgets = budgets.filter((b) => b.client_id === clientId);
          if (clientBudgets.length === 1) {
            updates.editedBudgetId = clientBudgets[0].id;
          }
        }

        // Auto-suggest project if single active project for client
        if (inv.editedProjectId === undefined) {
          const clientProjects = projects.filter((p) => p.client_id === clientId);
          if (clientProjects.length === 1) {
            updates.editedProjectId = clientProjects[0].id;
          }
        }

        return Object.keys(updates).length > 0 ? { ...inv, ...updates } : inv;
      })
    );
  }, [contracts, budgets, projects]);

  const resetState = () => {
    setPhase('upload');
    setExtractedInvoices([]);
    setProcessingProgress(0);
    setIsDragging(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data:application/pdf;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const processFiles = async (files: File[]) => {
    // Filter only PDFs and limit to 10
    const pdfFiles = files
      .filter((f) => f.type === 'application/pdf')
      .slice(0, 10);

    if (pdfFiles.length === 0) {
      toast.error('Solo se permiten archivos PDF');
      return;
    }

    if (pdfFiles.length < files.length) {
      toast.warning(
        `Se ignoraron ${files.length - pdfFiles.length} archivos que no son PDF`
      );
    }

    // Initialize invoices with processing status
    const initialInvoices: ExtractedInvoice[] = pdfFiles.map((file) => ({
      id: crypto.randomUUID(),
      fileName: file.name,
      pdfBase64: '',
      status: 'processing' as const,
    }));

    setExtractedInvoices(initialInvoices);
    setPhase('processing');
    setProcessingProgress(0);

    // Process each file
    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i];
      const invoiceId = initialInvoices[i].id;

      try {
        // Convert to base64
        const base64 = await fileToBase64(file);

        // Call edge function
        const { data, error } = await supabase.functions.invoke('extract-invoice-data', {
          body: { pdf_base64: base64, clients },
        });

        if (error) {
          throw new Error(error.message || 'Error al procesar');
        }

        if (data.error) {
          throw new Error(data.error);
        }

        // Update invoice with extracted data
        setExtractedInvoices((prev) =>
          prev.map((inv) =>
            inv.id === invoiceId
              ? {
                  ...inv,
                  pdfBase64: base64,
                  status: 'success' as const,
                  data: {
                    invoice_code: data.invoice_code || '',
                    client_name: data.client_name || '',
                    client_id: data.client_id || null,
                    client_matched: data.client_matched || false,
                    invoice_date: data.invoice_date || new Date().toISOString().split('T')[0],
                    due_date: data.due_date || null,
                    subtotal: data.subtotal || 0,
                    tax_rate: data.tax_rate || 21,
                    tax_amount: data.tax_amount || 0,
                    total_amount: data.total_amount || 0,
                    line_items: data.line_items || [],
                  },
                }
              : inv
          )
        );
      } catch (error) {
        console.error('Error processing invoice:', error);
        setExtractedInvoices((prev) =>
          prev.map((inv) =>
            inv.id === invoiceId
              ? {
                  ...inv,
                  status: 'error' as const,
                  error: error instanceof Error ? error.message : 'Error desconocido',
                }
              : inv
          )
        );
      }

      // Update progress
      setProcessingProgress(((i + 1) / pdfFiles.length) * 100);
    }

    setPhase('review');
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      processFiles(files);
    },
    [clients]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      processFiles(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpdateInvoice = (id: string, updates: Partial<ExtractedInvoice>) => {
    setExtractedInvoices((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, ...updates } : inv))
    );
  };

  const handleRemoveInvoice = (id: string) => {
    setExtractedInvoices((prev) => prev.filter((inv) => inv.id !== id));
  };

  // Save all invoices mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const successInvoices = extractedInvoices.filter(
        (inv) => inv.status === 'success' && inv.data
      );

      // Validate all have client selected
      const missingClient = successInvoices.find(
        (inv) => !(inv.editedClientId ?? inv.data?.client_id)
      );
      if (missingClient) {
        throw new Error(
          `La factura ${missingClient.editedCode ?? missingClient.data?.invoice_code} no tiene cliente seleccionado`
        );
      }

      // Check for duplicate codes before inserting
      const codes = successInvoices.map((inv) => inv.editedCode ?? inv.data!.invoice_code);
      const { data: existingInvoices } = await supabase
        .from('invoices')
        .select('code')
        .in('code', codes);
      
      const existingCodes = new Set((existingInvoices || []).map((inv) => inv.code));
      const duplicates = codes.filter((code) => existingCodes.has(code));
      if (duplicates.length > 0) {
        throw new Error(
          `Ya existen facturas con los códigos: ${duplicates.join(', ')}. Modifica los códigos antes de importar.`
        );
      }

      const results = [];

      for (const invoice of successInvoices) {
        const data = invoice.data!;
        const clientId = invoice.editedClientId ?? data.client_id;
        const code = invoice.editedCode ?? data.invoice_code;
        const subtotal = invoice.editedSubtotal ?? data.subtotal;
        const taxRate = invoice.editedTaxRate ?? data.tax_rate;
        const invoiceStatus = invoice.editedInvoiceStatus ?? 'sent';
        
        // New association fields
        const budgetId = invoice.editedBudgetId ?? null;
        const contractId = invoice.editedContractId ?? null;
        const billingMonth = invoice.editedBillingMonth ?? null;
        const billingYear = invoice.editedBillingYear ?? null;

        const taxAmount = subtotal * (taxRate / 100);
        const total = subtotal + taxAmount;

        // Create invoice with new association fields
        const { data: createdInvoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            code,
            client_id: clientId!,
            invoice_date: data.invoice_date,
            due_date: data.due_date,
            subtotal,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            total_amount: total,
            status: invoiceStatus,
            notes: `Importada automáticamente desde PDF: ${invoice.fileName}`,
            sent_at: invoiceStatus === 'sent' || invoiceStatus === 'paid' || invoiceStatus === 'overdue' 
              ? new Date().toISOString() 
              : null,
            paid_at: invoiceStatus === 'paid' ? new Date().toISOString() : null,
            // Association fields
            budget_id: budgetId,
            contract_id: contractId,
            billing_period_month: billingMonth,
            billing_period_year: billingYear,
          })
          .select()
          .single();

        if (invoiceError) {
          if (invoiceError.message?.includes('duplicate key') || invoiceError.code === '23505') {
            throw new Error(`Ya existe una factura con el código "${code}". Modifica el código antes de importar.`);
          }
          throw new Error(`Error guardando ${code}: ${invoiceError.message}`);
        }

        // If budget is associated, mark it as invoiced
        if (budgetId) {
          await supabase
            .from('budgets')
            .update({ status: 'invoiced' })
            .eq('id', budgetId)
            .eq('status', 'approved');
        }

        // Upload PDF to storage
        const fileName = `${createdInvoice.id}/factura.pdf`;
        
        // Convert base64 back to blob
        const byteCharacters = atob(invoice.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });

        const { error: uploadError } = await supabase.storage
          .from('invoice-files')
          .upload(fileName, blob, { upsert: true });

        if (uploadError) {
          console.error('Error uploading PDF:', uploadError);
        } else {
          // Get public URL and update invoice
          const { data: urlData } = supabase.storage
            .from('invoice-files')
            .getPublicUrl(fileName);

          await supabase
            .from('invoices')
            .update({ pdf_url: urlData.publicUrl })
            .eq('id', createdInvoice.id);
        }

        results.push(createdInvoice);
      }

      return results;
    },
    onSuccess: (results) => {
      toast.success(`${results.length} factura(s) importada(s) correctamente`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      handleClose();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Error al guardar facturas');
    },
  });

  const successCount = extractedInvoices.filter((inv) => inv.status === 'success').length;
  const errorCount = extractedInvoices.filter((inv) => inv.status === 'error').length;
  const processingCount = extractedInvoices.filter((inv) => inv.status === 'processing').length;
  const missingClientCount = extractedInvoices.filter(
    (inv) => inv.status === 'success' && !(inv.editedClientId ?? inv.data?.client_id)
  ).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={phase === 'review' ? 'max-w-7xl' : 'max-w-lg'}>
        <DialogHeader>
          <DialogTitle>
            {phase === 'upload' && 'Importar Facturas'}
            {phase === 'processing' && 'Procesando Facturas'}
            {phase === 'review' && 'Revisar Datos Extraídos'}
          </DialogTitle>
          <DialogDescription>
            {phase === 'upload' &&
              'Sube los PDFs de las facturas y extraeremos los datos automáticamente'}
            {phase === 'processing' &&
              'Analizando las facturas con inteligencia artificial...'}
            {phase === 'review' &&
              `Se extrajeron ${successCount} factura(s). Revisa los datos antes de guardar.`}
          </DialogDescription>
        </DialogHeader>

        {/* Upload Phase */}
        {phase === 'upload' && (
          <div className="space-y-4">
            <div
              className={`
                flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8
                transition-colors cursor-pointer
                ${isDragging 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-primary/50'
                }
              `}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
              <p className="mb-1 text-sm font-medium">
                Arrastra tus facturas aquí
              </p>
              <p className="text-xs text-muted-foreground">
                o haz clic para seleccionar (PDF, hasta 10 archivos)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </div>
        )}

        {/* Processing Phase */}
        {phase === 'processing' && (
          <div className="space-y-4">
            <Progress value={processingProgress} className="h-2" />
            <div className="space-y-2">
              {extractedInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center gap-2 text-sm"
                >
                  {inv.status === 'processing' && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  {inv.status === 'success' && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  {inv.status === 'error' && (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className={inv.status === 'error' ? 'text-destructive' : ''}>
                    {inv.fileName}
                    {inv.status === 'error' && `: ${inv.error}`}
                  </span>
                </div>
              ))}
            </div>
            {processingCount === 0 && (
              <Button onClick={() => setPhase('review')} className="w-full">
                Continuar
              </Button>
            )}
          </div>
        )}

        {/* Review Phase */}
        {phase === 'review' && (
          <div className="space-y-4">
            {errorCount > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {errorCount} factura(s) no pudieron ser procesadas
                </AlertDescription>
              </Alert>
            )}

            {missingClientCount > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {missingClientCount} factura(s) requieren selección manual de cliente
                </AlertDescription>
              </Alert>
            )}

            <div className="max-h-[500px] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Código</TableHead>
                    <TableHead className="w-[180px]">Cliente</TableHead>
                    <TableHead className="w-[90px]">Fecha</TableHead>
                    <TableHead className="w-[110px]">Subtotal</TableHead>
                    <TableHead className="w-[80px]">IVA</TableHead>
                    <TableHead className="w-[100px] text-right">Total</TableHead>
                    <TableHead className="w-[100px]">Estado</TableHead>
                    <TableHead className="w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {extractedInvoices.map((invoice) => (
                    <ExtractedInvoiceRow
                      key={invoice.id}
                      invoice={invoice}
                      clients={clients}
                      contracts={contracts}
                      budgets={budgets}
                      projects={projects}
                      onUpdate={handleUpdateInvoice}
                      onRemove={handleRemoveInvoice}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={successCount === 0 || missingClientCount > 0 || saveMutation.isPending}
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  `Importar ${successCount} Factura(s)`
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
