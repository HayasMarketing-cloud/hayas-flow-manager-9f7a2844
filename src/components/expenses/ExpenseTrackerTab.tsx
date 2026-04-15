import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle2, Clock, FileCheck } from 'lucide-react';
import { useExpenses, useExpenseRecords, ExpenseRecord } from '@/hooks/useExpenses';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
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

export function ExpenseTrackerTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));

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

  const handleFileUpload = async (expenseId: string, month: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const path = `${year}/${month}/${expenseId}/${file.name}`;
      const { error: uploadError } = await supabase.storage.from('expense-invoices').upload(path, file, { upsert: true });
      if (uploadError) { toast.error('Error al subir: ' + uploadError.message); return; }
      const { data: { publicUrl } } = supabase.storage.from('expense-invoices').getPublicUrl(path);
      upsertRecord.mutate({
        expense_id: expenseId,
        period_year: year,
        period_month: month,
        status: 'uploaded',
        invoice_url: publicUrl,
        amount: expenses.find(e => e.id === expenseId)?.monthly_cost || null,
        notes: null,
        uploaded_at: new Date().toISOString(),
      });
      toast.success('Factura subida');
    };
    input.click();
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
    });
  };

  // Stats
  const totalCells = activeExpenses.length * months.length;
  const uploadedCells = months.reduce((acc, m) => acc + activeExpenses.filter(e => {
    const r = getRecord(e.id, m);
    return r && (r.status === 'uploaded' || r.status === 'verified');
  }).length, 0);
  const verifiedCells = months.reduce((acc, m) => acc + activeExpenses.filter(e => getRecord(e.id, m)?.status === 'verified').length, 0);
  const completeness = totalCells > 0 ? Math.round((uploadedCells / totalCells) * 100) : 0;

  return (
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
                <TableHead key={m} className="text-center min-w-[140px]">{MONTH_NAMES[m - 1]} {year}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeExpenses.length === 0 ? (
              <TableRow><TableCell colSpan={2 + months.length} className="text-center text-muted-foreground py-8">No hay gastos activos</TableCell></TableRow>
            ) : activeExpenses.map(exp => (
              <TableRow key={exp.id}>
                <TableCell className="font-medium">{exp.name}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(exp.monthly_cost)}
                </TableCell>
                {months.map(m => {
                  const record = getRecord(exp.id, m);
                  const status = record?.status || 'pending';
                  const cfg = statusConfig[status];
                  const Icon = cfg.icon;
                  return (
                    <TableCell key={m} className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className={`flex items-center gap-1 text-xs ${cfg.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                          <span>{cfg.label}</span>
                        </div>
                        <div className="flex gap-1">
                          {status === 'pending' && (
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
                            </>
                          )}
                          {status === 'verified' && record?.invoice_url && (
                            <a href={record.invoice_url} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 underline">Ver factura</a>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
