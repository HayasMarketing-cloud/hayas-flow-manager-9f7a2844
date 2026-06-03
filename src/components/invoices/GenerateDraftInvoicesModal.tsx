import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertTriangle, FileText, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/invoice-utils';

interface PreviewInvoice {
  type: 'contract' | 'budget';
  client_name: string;
  source_code: string;
  source_title: string;
  amount: number;
  milestone_label?: string;
  request_count?: number;
}
interface PreviewResp {
  dry_run: boolean;
  month_label: string;
  preview: PreviewInvoice[];
  warnings: Array<{ level: string; message: string }>;
  created_count: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const GenerateDraftInvoicesModal = ({ open, onOpenChange }: Props) => {
  const queryClient = useQueryClient();
  const now = new Date();
  const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // previous month
  const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const [year, setYear] = useState<number>(defaultYear);
  const [month, setMonth] = useState<number>(defaultMonth);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewResp | null>(null);

  const callFn = async (dryRun: boolean) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No hay sesión activa');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-draft-invoices`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ year, month, dry_run: dryRun }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error desconocido');
      setPreview(json);

      if (!dryRun) {
        toast.success(`${json.created_count} factura(s) borrador creada(s)`);
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      } else {
        toast.success(`Previsualización: ${json.preview.length} factura(s) y ${json.warnings.length} aviso(s)`);
      }
    } catch (e: any) {
      toast.error('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = preview?.preview.reduce((s, p) => s + p.amount, 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setPreview(null); onOpenChange(o); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generar borradores de facturas del mes</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Año</Label>
              <Select value={String(year)} onValueChange={(v) => { setYear(Number(v)); setPreview(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[defaultYear - 1, defaultYear, defaultYear + 1].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mes</Label>
              <Select value={String(month)} onValueChange={(v) => { setMonth(Number(v)); setPreview(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Alert>
            <AlertTitle>¿Qué hace?</AlertTitle>
            <AlertDescription className="text-sm">
              <p>• El mes seleccionado es el <b>mes de trabajo</b> (N).</p>
              <p>• <b>Contratos activos</b>: 1 factura por contrato con todas las requests <code>completed</code> del mes (N) en una línea + enlace al Google Sheet.</p>
              <p>• <b>Presupuestos aprobados</b>: se incluyen aquellos cuya <b>fecha de facturación</b> cae en el mes siguiente (N+1), porque trabajo de N se factura en N+1. Se omiten los ya facturados (asignados a otra factura).</p>
              <p>• Las facturas se crean en estado <b>borrador</b> para revisión por finanzas.</p>
            </AlertDescription>
          </Alert>

          {preview && (
            <>
              {preview.warnings.length > 0 && (
                <Alert variant="default" className="border-amber-300 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">Avisos ({preview.warnings.length})</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc ml-4 text-sm text-amber-700">
                      {preview.warnings.map((w, i) => <li key={i}>{w.message}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold">
                    {preview.dry_run ? 'Previsualización' : 'Resultado'} — {preview.month_label}
                  </h4>
                  <Badge variant="secondary">
                    {preview.preview.length} factura(s) · {formatCurrency(totalAmount)}
                  </Badge>
                </div>
                {preview.preview.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay facturas a generar para este mes.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Origen</TableHead>
                        <TableHead>Detalle</TableHead>
                        <TableHead className="text-right">Importe</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.preview.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Badge variant={p.type === 'contract' ? 'default' : 'outline'}>
                              {p.type === 'contract' ? 'Contrato' : 'Presupuesto'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{p.client_name}</TableCell>
                          <TableCell className="font-mono text-xs">{p.source_code}</TableCell>
                          <TableCell className="text-sm">
                            {p.source_title}
                            {p.milestone_label && <span className="text-muted-foreground"> — {p.milestone_label}</span>}
                            {p.request_count && <span className="text-muted-foreground"> · {p.request_count} requests</span>}
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(p.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cerrar
          </Button>
          <Button variant="outline" onClick={() => callFn(true)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
            Previsualizar
          </Button>
          <Button
            onClick={() => callFn(false)}
            disabled={loading || !preview || preview.preview.length === 0}
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            Generar borradores
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
