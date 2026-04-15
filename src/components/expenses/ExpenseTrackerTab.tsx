import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, CheckCircle2, Clock, FileCheck, Loader2, FolderUp, Trash2 } from 'lucide-react';
import { useExpenses, useExpenseRecords, ExpenseRecord } from '@/hooks/useExpenses';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTH_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const QUARTERS = [
  { label: 'Q1', months: [1, 2, 3] },
  { label: 'Q2', months: [4, 5, 6] },
  { label: 'Q3', months: [7, 8, 9] },
  { label: 'Q4', months: [10, 11, 12] },
];

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  pending: { icon: Clock, color: 'text-amber-500', label: 'Pendiente' },
  uploaded: { icon: Upload, color: 'text-blue-500', label: 'Subida' },
  verified: { icon: CheckCircle2, color: 'text-green-500', label: 'Verificada' },
};

const formatCurrency = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v) : '—';

interface BulkFile {
  file: File;
  month: number;
}

export function ExpenseTrackerTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));
  const [extractingCell, setExtractingCell] = useState<string | null>(null);
  const [bulkModal, setBulkModal] = useState<{ expenseId: string; expenseName: string } | null>(null);
  const [bulkFiles, setBulkFiles] = useState<BulkFile[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ expenseId: string; month: number } | null>(null);

  const { data: expenses = [] } = useExpenses();
  const { data: records = [], upsertRecord } = useExpenseRecords(year);

  const activeExpenses = expenses.filter(e => e.is_active);
  const months = QUARTERS[quarter - 1].months;

  const recordMap = useMemo(() => {
    const map: Record<string, ExpenseRecord> = {};
    records.forEach(r => { map[`${r.expense_id}-${r.period_year}-${r.period_month}`] = r; });
    return map;
  }, [records]);

  const getRecord = (expenseId: string, month: number) => recordMap[`${expenseId}-${year}-${month}`];

  const getStoragePathFromUrl = (invoiceUrl: string | null) => {
    if (!invoiceUrl) return null;

    const publicMarker = '/storage/v1/object/public/expense-invoices/';
    const publicIndex = invoiceUrl.indexOf(publicMarker);

    if (publicIndex >= 0) {
      return decodeURIComponent(invoiceUrl.slice(publicIndex + publicMarker.length));
    }

    return null;
  };

  const buildPendingRecord = (expenseId: string, month: number) => ({
    expense_id: expenseId,
    period_year: year,
    period_month: month,
    status: 'pending',
    invoice_url: null,
    amount: expenses.find(e => e.id === expenseId)?.monthly_cost || null,
    notes: null,
    uploaded_at: null,
    issuer_name: null,
    description: null,
    subtotal: null,
    tax_rate: null,
    tax_amount: null,
    total_amount: null,
    invoice_date: null,
  });

  const extractInvoiceData = async (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const { data, error } = await supabase.functions.invoke('extract-expense-invoice', {
            body: { pdf_base64: base64 },
          });
          if (error) throw error;
          resolve(data);
        } catch (e) {
          reject(e);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const uploadSingleFile = async (expenseId: string, month: number, file: File) => {
    const path = `${year}/${month}/${expenseId}/${file.name}`;
    const { error: uploadError } = await supabase.storage.from('expense-invoices').upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage.from('expense-invoices').getPublicUrl(path);

    let extracted: any = {};
    try {
      extracted = await extractInvoiceData(file);
    } catch (aiError) {
      console.error('AI extraction failed:', aiError);
    }

    const defaultCost = expenses.find(e => e.id === expenseId)?.monthly_cost || null;

    await new Promise<void>((resolve, reject) => {
      upsertRecord.mutate({
        expense_id: expenseId,
        period_year: year,
        period_month: month,
        status: 'uploaded',
        invoice_url: publicUrl,
        amount: extracted.total_amount ?? defaultCost,
        notes: null,
        uploaded_at: new Date().toISOString(),
        issuer_name: extracted.issuer_name ?? null,
        description: extracted.description ?? null,
        subtotal: extracted.subtotal ?? null,
        tax_rate: extracted.tax_rate ?? null,
        tax_amount: extracted.tax_amount ?? null,
        total_amount: extracted.total_amount ?? null,
        invoice_date: extracted.invoice_date ?? null,
      }, { onSuccess: () => resolve(), onError: (e) => reject(e) });
    });
  };

  const handleFileUpload = async (expenseId: string, month: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const cellKey = `${expenseId}-${month}`;
      setExtractingCell(cellKey);

      try {
        await uploadSingleFile(expenseId, month, file);
        toast.success('Factura subida y procesada');
      } catch (err: any) {
        toast.error('Error: ' + err.message);
      } finally {
        setExtractingCell(null);
      }
    };
    input.click();
  };

  const handleBulkOpen = (expenseId: string, expenseName: string) => {
    setBulkFiles([]);
    setBulkModal({ expenseId, expenseName });
  };

  const handleBulkFilesSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png';
    input.multiple = true;
    input.onchange = (e: any) => {
      const files = Array.from(e.target.files || []) as File[];
      // Auto-assign months in order of quarter
      const newBulkFiles: BulkFile[] = files.map((file, i) => ({
        file,
        month: months[i % months.length],
      }));
      setBulkFiles(newBulkFiles);
    };
    input.click();
  };

  const handleBulkUpload = async () => {
    if (!bulkModal || bulkFiles.length === 0) return;
    setBulkUploading(true);
    let success = 0;
    let failed = 0;

    for (const bf of bulkFiles) {
      try {
        setExtractingCell(`${bulkModal.expenseId}-${bf.month}`);
        await uploadSingleFile(bulkModal.expenseId, bf.month, bf.file);
        success++;
      } catch (err: any) {
        console.error(`Error uploading for month ${bf.month}:`, err);
        failed++;
      }
    }

    setExtractingCell(null);
    setBulkUploading(false);
    setBulkModal(null);
    setBulkFiles([]);

    if (failed === 0) {
      toast.success(`${success} facturas subidas y procesadas correctamente`);
    } else {
      toast.warning(`${success} subidas, ${failed} con error`);
    }
  };

  const handleVerify = (expenseId: string, month: number) => {
    const existing = getRecord(expenseId, month);
    upsertRecord.mutate({
      expense_id: expenseId,
      period_year: year,
      period_month: month,
      status: 'verified',
      invoice_url: existing?.invoice_url || null,
      amount: existing?.amount || expenses.find(e => e.id === expenseId)?.monthly_cost || null,
      notes: existing?.notes || null,
      uploaded_at: existing?.uploaded_at || null,
      issuer_name: existing?.issuer_name ?? null,
      description: existing?.description ?? null,
      subtotal: existing?.subtotal ?? null,
      tax_rate: existing?.tax_rate ?? null,
      tax_amount: existing?.tax_amount ?? null,
      total_amount: existing?.total_amount ?? null,
      invoice_date: existing?.invoice_date ?? null,
    });
  };

  const handleDeleteInvoice = async () => {
    if (!deleteTarget) return;

    const { expenseId, month } = deleteTarget;
    const existing = getRecord(expenseId, month);
    const cellKey = `${expenseId}-${month}`;

    setExtractingCell(cellKey);

    try {
      const storagePath = getStoragePathFromUrl(existing?.invoice_url || null);

      if (storagePath) {
        const { error: removeError } = await supabase.storage.from('expense-invoices').remove([storagePath]);
        if (removeError) throw removeError;
      }

      await new Promise<void>((resolve, reject) => {
        upsertRecord.mutate(buildPendingRecord(expenseId, month), {
          onSuccess: () => resolve(),
          onError: (e) => reject(e),
        });
      });

      toast.success('Factura eliminada del mes');
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error('Error al eliminar: ' + err.message);
    } finally {
      setExtractingCell(null);
    }
  };

  // Stats
  const totalCells = activeExpenses.length * months.length;
  const uploadedCells = months.reduce((acc, m) => acc + activeExpenses.filter(e => {
    const r = getRecord(e.id, m);
    return r && (r.status === 'uploaded' || r.status === 'verified');
  }).length, 0);
  const verifiedCells = months.reduce((acc, m) => acc + activeExpenses.filter(e => getRecord(e.id, m)?.status === 'verified').length, 0);
  const completeness = totalCells > 0 ? Math.round((uploadedCells / totalCells) * 100) : 0;

  const ExtractedDataTooltip = ({ record }: { record: ExpenseRecord }) => (
    <div className="text-xs space-y-1 max-w-[250px]">
      {record.issuer_name && <div><span className="font-semibold">Emisor:</span> {record.issuer_name}</div>}
      {record.description && <div><span className="font-semibold">Concepto:</span> {record.description}</div>}
      {record.invoice_date && <div><span className="font-semibold">Fecha:</span> {new Date(record.invoice_date).toLocaleDateString('es-ES')}</div>}
      {record.subtotal != null && <div><span className="font-semibold">Base:</span> {formatCurrency(record.subtotal)}</div>}
      {(record.tax_rate != null && record.tax_rate > 0) && <div><span className="font-semibold">IVA ({record.tax_rate}%):</span> {formatCurrency(record.tax_amount)}</div>}
      {record.total_amount != null && <div><span className="font-semibold">Total:</span> {formatCurrency(record.total_amount)}</div>}
    </div>
  );

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2 items-center">
            <Select value={year.toString()} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={quarter.toString()} onValueChange={v => setQuarter(Number(v))}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                {QUARTERS.map((q, i) => <SelectItem key={i} value={(i + 1).toString()}>{q.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">Completado: <span className="font-semibold text-foreground">{completeness}%</span></span>
            <Progress value={completeness} className="w-32 h-2" />
            <Badge variant="outline">{uploadedCells}/{totalCells} subidas</Badge>
            <Badge variant="outline" className="text-green-600">{verifiedCells} verificadas</Badge>
          </div>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Gasto</TableHead>
                <TableHead className="text-right min-w-[100px]">Coste/mes</TableHead>
                {months.map(m => (
                  <TableHead key={m} className="text-center min-w-[160px]">{MONTH_NAMES[m - 1]} {year}</TableHead>
                ))}
                <TableHead className="text-center w-[80px]">Trimestre</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeExpenses.length === 0 ? (
                <TableRow><TableCell colSpan={3 + months.length} className="text-center text-muted-foreground py-8">No hay gastos activos</TableCell></TableRow>
              ) : activeExpenses.map(exp => {
                const pendingMonths = months.filter(m => !getRecord(exp.id, m) || getRecord(exp.id, m)?.status === 'pending');
                const allUploaded = pendingMonths.length === 0;

                return (
                  <TableRow key={exp.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col items-start gap-2">
                        <span>{exp.name}</span>
                        {!allUploaded && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => handleBulkOpen(exp.id, exp.name)}
                          >
                            <FolderUp className="h-3.5 w-3.5" />
                            Subir trimestre ({pendingMonths.length})
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(exp.monthly_cost)}
                    </TableCell>
                    {months.map(m => {
                      const record = getRecord(exp.id, m);
                      const status = record?.status || 'pending';
                      const cfg = statusConfig[status];
                      const Icon = cfg.icon;
                      const cellKey = `${exp.id}-${m}`;
                      const isExtracting = extractingCell === cellKey;
                      const hasExtractedData = record && (record.issuer_name || record.total_amount != null);

                      return (
                        <TableCell key={m} className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            {isExtracting ? (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>Procesando...</span>
                              </div>
                            ) : (
                              <>
                                <div className={`flex items-center gap-1 text-xs ${cfg.color}`}>
                                  <Icon className="h-3.5 w-3.5" />
                                  <span>{cfg.label}</span>
                                </div>
                                {hasExtractedData && record && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-[11px] font-mono text-foreground cursor-help">
                                        {formatCurrency(record.total_amount)}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                      <ExtractedDataTooltip record={record} />
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </>
                            )}
                            <div className="flex gap-1">
                              {status === 'pending' && !isExtracting && (
                                <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => handleFileUpload(exp.id, m)}>
                                  <Upload className="h-3 w-3 mr-1" />Subir
                                </Button>
                              )}
                              {status === 'uploaded' && (
                                <>
                                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => handleVerify(exp.id, m)}>
                                    <FileCheck className="h-3 w-3 mr-1" />Verificar
                                  </Button>
                                  {record?.invoice_url && (
                                    <a href={record.invoice_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline">Ver</a>
                                  )}
                                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setDeleteTarget({ expenseId: exp.id, month: m })}>
                                      <Trash2 className="h-3 w-3 mr-1" />Eliminar
                                    </Button>
                                </>
                              )}
                               {status === 'verified' && (
                                 <>
                                   {record?.invoice_url && (
                                     <a href={record.invoice_url} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 underline">Ver factura</a>
                                   )}
                                   <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setDeleteTarget({ expenseId: exp.id, month: m })}>
                                     <Trash2 className="h-3 w-3 mr-1" />Eliminar
                                   </Button>
                                 </>
                               )}
                            </div>
                          </div>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center">
                      {!allUploaded ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleBulkOpen(exp.id, exp.name)}
                            >
                              <FolderUp className="h-3.5 w-3.5" />
                              {pendingMonths.length}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Subir {pendingMonths.length} facturas del trimestre</TooltipContent>
                        </Tooltip>
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Bulk upload modal */}
        <Dialog open={!!bulkModal} onOpenChange={v => { if (!v) setBulkModal(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Subir facturas del trimestre — {bulkModal?.expenseName}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Selecciona hasta {months.length} facturas. Asigna cada una al mes correspondiente.
            </p>
            <Button variant="outline" onClick={handleBulkFilesSelect} disabled={bulkUploading}>
              <FolderUp className="h-4 w-4 mr-2" />Seleccionar archivos
            </Button>

            {bulkFiles.length > 0 && (
              <div className="space-y-2 mt-2">
                {bulkFiles.map((bf, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 border rounded-md text-sm">
                    <span className="truncate flex-1 font-medium">{bf.file.name}</span>
                    <Select
                      value={bf.month.toString()}
                      onValueChange={v => {
                        setBulkFiles(prev => prev.map((f, i) => i === idx ? { ...f, month: Number(v) } : f));
                      }}
                    >
                      <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {months.map(m => (
                          <SelectItem key={m} value={m.toString()}>{MONTH_FULL[m - 1]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setBulkModal(null)} disabled={bulkUploading}>Cancelar</Button>
              <Button onClick={handleBulkUpload} disabled={bulkFiles.length === 0 || bulkUploading}>
                {bulkUploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Procesando...</> : `Subir ${bulkFiles.length} facturas`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          title="Eliminar factura subida"
          description="Se borrará el PDF del mes seleccionado y ese mes volverá a estado pendiente para que puedas subir la factura correcta."
          confirmText="Eliminar PDF"
          onConfirm={handleDeleteInvoice}
          variant="destructive"
        />
      </div>
    </TooltipProvider>
  );
}
