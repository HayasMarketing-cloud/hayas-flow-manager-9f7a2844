import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, Loader2, Check, AlertCircle, Calendar, Receipt, Percent } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPeriod } from '@/lib/liquidation-utils';
import { LiquidationStatusBadge } from './LiquidationStatusBadge';
import { Database } from '@/integrations/supabase/types';

type LiquidationStatus = Database['public']['Enums']['liquidation_status'];

interface ExtractedData {
  invoice_number: string;
  invoice_date: string | null;
  period_month: number | null;
  period_year: number | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  irpf_rate: number | null;
  irpf_amount: number | null;
  total_amount: number;
  specialist_name: string | null;
}

interface LiquidationCandidate {
  id: string;
  code: string;
  period_month: number;
  period_year: number;
  subtotal: number;
  total_amount: number;
  status: string;
  specialist: { id: string; name: string } | null;
  matchScore: number;
  matchReason: string;
}

interface SpecialistInvoiceImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedLiquidationId?: string;
  onSuccess?: () => void;
}

type Phase = 'upload' | 'review' | 'confirm';

export function SpecialistInvoiceImportModal({
  open,
  onOpenChange,
  preselectedLiquidationId,
  onSuccess,
}: SpecialistInvoiceImportModalProps) {
  const [phase, setPhase] = useState<Phase>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [selectedLiquidationId, setSelectedLiquidationId] = useState<string | null>(preselectedLiquidationId || null);
  const [candidates, setCandidates] = useState<LiquidationCandidate[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();

  // Fetch liquidations for matching
  const { data: liquidations } = useQuery({
    queryKey: ['liquidations-for-matching'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('liquidations')
        .select(`
          id,
          code,
          period_month,
          period_year,
          subtotal,
          total_amount,
          status,
          specialist:specialists(id, name)
        `)
        .in('status', ['draft', 'validated', 'sent', 'accepted', 'invoice_received', 'pending_payment'])
        .is('specialist_invoice_url', null)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const resetState = () => {
    setPhase('upload');
    setIsProcessing(false);
    setExtractedData(null);
    setPdfFile(null);
    setPdfBase64(null);
    setSelectedLiquidationId(preselectedLiquidationId || null);
    setCandidates([]);
    setIsUploading(false);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const findCandidates = useCallback((data: ExtractedData, allLiquidations: typeof liquidations) => {
    if (!allLiquidations) return [];

    const scored: LiquidationCandidate[] = allLiquidations.map((liq) => {
      let score = 0;
      const reasons: string[] = [];

      // Period match (highest priority)
      if (data.period_month && data.period_year) {
        if (liq.period_month === data.period_month && liq.period_year === data.period_year) {
          score += 50;
          reasons.push('Período coincide');
        }
      }

      // Amount match (within 5% tolerance)
      const amountDiff = Math.abs(liq.total_amount - data.total_amount);
      const tolerance = liq.total_amount * 0.05;
      if (amountDiff <= tolerance) {
        score += 30;
        reasons.push('Importe similar');
      } else if (amountDiff <= liq.total_amount * 0.15) {
        score += 15;
        reasons.push('Importe aproximado');
      }

      // Specialist name match
      if (data.specialist_name && liq.specialist?.name) {
        const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (normalize(liq.specialist.name).includes(normalize(data.specialist_name)) ||
            normalize(data.specialist_name).includes(normalize(liq.specialist.name))) {
          score += 20;
          reasons.push('Nombre coincide');
        }
      }

      return {
        ...liq,
        specialist: liq.specialist as { id: string; name: string } | null,
        matchScore: score,
        matchReason: reasons.join(', ') || 'Sin coincidencias directas',
      };
    });

    return scored.filter(s => s.matchScore > 0).sort((a, b) => b.matchScore - a.matchScore);
  }, []);

  const handleFileProcess = async (file: File) => {
    if (!file.type.includes('pdf')) {
      toast.error('Solo se permiten archivos PDF');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('El archivo no puede superar 10MB');
      return;
    }

    setPdfFile(file);
    setIsProcessing(true);

    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setPdfBase64(base64);

      // Call AI extraction
      const { data, error } = await supabase.functions.invoke('extract-specialist-invoice-data', {
        body: { pdf_base64: base64 },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setExtractedData(data);

      // Find matching candidates
      const matchedCandidates = findCandidates(data, liquidations);
      setCandidates(matchedCandidates);

      // Auto-select if only one high-confidence match
      if (matchedCandidates.length === 1 && matchedCandidates[0].matchScore >= 50) {
        setSelectedLiquidationId(matchedCandidates[0].id);
      } else if (preselectedLiquidationId) {
        setSelectedLiquidationId(preselectedLiquidationId);
      }

      setPhase('review');
    } catch (error: any) {
      console.error('Error processing invoice:', error);
      toast.error(error.message || 'Error al procesar la factura');
      setPdfFile(null);
      setPdfBase64(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileProcess(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileProcess(file);
    e.target.value = '';
  };

  const handleConfirm = async () => {
    if (!selectedLiquidationId || !pdfBase64 || !pdfFile) {
      toast.error('Selecciona una liquidación');
      return;
    }

    setIsUploading(true);

    try {
      const filePath = `${selectedLiquidationId}/factura-especialista.pdf`;

      // Upload PDF to storage
      const { error: uploadError } = await supabase.storage
        .from('liquidation-invoices')
        .upload(filePath, pdfFile, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('liquidation-invoices')
        .getPublicUrl(filePath);

      // Get current liquidation status
      const selectedLiq = liquidations?.find(l => l.id === selectedLiquidationId);
      const updateData: { specialist_invoice_url: string; status?: LiquidationStatus } = {
        specialist_invoice_url: publicUrlData.publicUrl,
      };

      // Determinar nuevo estado según estado actual
      if (['draft', 'validated', 'sent'].includes(selectedLiq?.status || '')) {
        // Auto-aceptar y marcar factura recibida
        updateData.status = 'invoice_received';
        
        // Verificar si importes coinciden (comparar subtotales con tolerancia de 1€)
        const amountsMatch = Math.abs((extractedData?.subtotal || 0) - (selectedLiq?.subtotal || 0)) <= 1;
        
        if (amountsMatch) {
          toast.success('Liquidación aceptada automáticamente - importes coinciden');
        } else {
          toast.warning(`Atención: El importe de la factura (${formatCurrency(extractedData?.subtotal || 0)}) difiere de la liquidación (${formatCurrency(selectedLiq?.subtotal || 0)})`);
        }
      } else if (selectedLiq?.status === 'accepted') {
        updateData.status = 'invoice_received';
      }

      // Update liquidation
      const { error: updateError } = await supabase
        .from('liquidations')
        .update(updateData)
        .eq('id', selectedLiquidationId);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['liquidations'] });
      queryClient.invalidateQueries({ queryKey: ['liquidation-detail'] });
      queryClient.invalidateQueries({ queryKey: ['liquidations-for-matching'] });

      if (!['draft', 'validated', 'sent'].includes(selectedLiq?.status || '')) {
        toast.success('Factura asociada correctamente');
      }
      onSuccess?.();
      handleClose();
    } catch (error: any) {
      console.error('Error uploading invoice:', error);
      toast.error('Error al subir la factura: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getMonthName = (month: number) => {
    return new Date(2024, month - 1).toLocaleDateString('es-ES', { month: 'long' });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Importar Factura de Especialista
          </DialogTitle>
          <DialogDescription>
            {phase === 'upload' && 'Sube un PDF de factura para extraer los datos automáticamente'}
            {phase === 'review' && 'Revisa los datos extraídos y selecciona la liquidación'}
            {phase === 'confirm' && 'Confirma para asociar la factura'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-4">
          <div className={cn("flex items-center gap-1", phase === 'upload' ? 'text-primary' : 'text-muted-foreground')}>
            <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium", 
              phase === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
              1
            </div>
            <span className="text-sm">Subir</span>
          </div>
          <Separator className="flex-1" />
          <div className={cn("flex items-center gap-1", phase === 'review' ? 'text-primary' : 'text-muted-foreground')}>
            <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium", 
              phase === 'review' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
              2
            </div>
            <span className="text-sm">Revisar</span>
          </div>
          <Separator className="flex-1" />
          <div className={cn("flex items-center gap-1", phase === 'confirm' ? 'text-primary' : 'text-muted-foreground')}>
            <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium", 
              phase === 'confirm' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
              3
            </div>
            <span className="text-sm">Confirmar</span>
          </div>
        </div>

        {/* Phase: Upload */}
        {phase === 'upload' && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            className={cn(
              "relative border-2 border-dashed rounded-lg p-12 transition-colors",
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            )}
          >
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isProcessing}
            />
            <div className="flex flex-col items-center gap-4 text-center">
              {isProcessing ? (
                <>
                  <Loader2 className="h-12 w-12 text-primary animate-spin" />
                  <div>
                    <p className="text-lg font-medium">Procesando factura...</p>
                    <p className="text-sm text-muted-foreground">
                      Extrayendo datos con IA
                    </p>
                  </div>
                  <Progress value={66} className="w-48" />
                </>
              ) : (
                <>
                  <Upload className={cn("h-12 w-12", isDragOver ? "text-primary" : "text-muted-foreground")} />
                  <div>
                    <p className="text-lg font-medium">
                      Arrastra el PDF o haz clic para seleccionar
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Solo archivos PDF (máx. 10MB)
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Phase: Review */}
        {phase === 'review' && extractedData && (
          <div className="space-y-6">
            {/* Extracted Data */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Datos extraídos</h3>
                  {pdfFile && (
                    <Badge variant="secondary" className="ml-auto">
                      {pdfFile.name}
                    </Badge>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Nº Factura</p>
                    <p className="font-medium">{extractedData.invoice_number || '-'}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-muted-foreground">Fecha</p>
                      <p className="font-medium">{formatDate(extractedData.invoice_date)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Período</p>
                    <p className="font-medium">
                      {extractedData.period_month && extractedData.period_year
                        ? `${getMonthName(extractedData.period_month)} ${extractedData.period_year}`
                        : 'No detectado'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Emisor</p>
                    <p className="font-medium">{extractedData.specialist_name || '-'}</p>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base imponible</span>
                    <span className="font-medium">{formatCurrency(extractedData.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Percent className="h-3 w-3" />
                      IVA ({extractedData.tax_rate}%)
                    </span>
                    <span className="font-medium">{formatCurrency(extractedData.tax_amount)}</span>
                  </div>
                  {extractedData.irpf_rate != null && extractedData.irpf_amount != null && (
                    <div className="flex justify-between text-amber-600">
                      <span className="flex items-center gap-1">
                        <Percent className="h-3 w-3" />
                        IRPF (-{extractedData.irpf_rate}%)
                      </span>
                      <span className="font-medium">-{formatCurrency(extractedData.irpf_amount)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-base font-bold">
                    <span>TOTAL</span>
                    <span className="text-primary">{formatCurrency(extractedData.total_amount)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Liquidation Selection */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Check className="h-4 w-4" />
                Seleccionar liquidación
              </h3>

              {candidates.length > 0 ? (
                <RadioGroup value={selectedLiquidationId || ''} onValueChange={setSelectedLiquidationId}>
                  <div className="space-y-2">
                    {candidates.map((candidate) => (
                      <Label
                        key={candidate.id}
                        htmlFor={candidate.id}
                        className={cn(
                          "flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                          selectedLiquidationId === candidate.id
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        )}
                      >
                        <RadioGroupItem value={candidate.id} id={candidate.id} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{candidate.code}</span>
                            <LiquidationStatusBadge status={candidate.status as any} />
                            {candidate.matchScore >= 50 && (
                              <Badge variant="default" className="text-xs">
                                Mejor coincidencia
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {formatPeriod(candidate.period_year, candidate.period_month)} • 
                            {candidate.specialist?.name} • 
                            {formatCurrency(candidate.total_amount)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {candidate.matchReason}
                          </p>
                        </div>
                      </Label>
                    ))}
                  </div>
                </RadioGroup>
              ) : liquidations && liquidations.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-800 rounded-lg">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-sm">No se encontraron coincidencias. Selecciona manualmente:</p>
                  </div>
                  <RadioGroup value={selectedLiquidationId || ''} onValueChange={setSelectedLiquidationId}>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {liquidations.map((liq) => (
                        <Label
                          key={liq.id}
                          htmlFor={liq.id}
                          className={cn(
                            "flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors",
                            selectedLiquidationId === liq.id
                              ? "border-primary bg-primary/5"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <RadioGroupItem value={liq.id} id={liq.id} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{liq.code}</span>
                              <LiquidationStatusBadge status={liq.status as any} />
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatPeriod(liq.period_year, liq.period_month)} • 
                              {(liq.specialist as any)?.name} • 
                              {formatCurrency(liq.total_amount)}
                            </div>
                          </div>
                        </Label>
                      ))}
                    </div>
                  </RadioGroup>
                </div>
              ) : (
                <div className="text-center p-6 bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground">
                    No hay liquidaciones pendientes de factura
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPhase('upload')}>
                Volver
              </Button>
              <Button 
                onClick={() => setPhase('confirm')} 
                disabled={!selectedLiquidationId}
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* Phase: Confirm */}
        {phase === 'confirm' && extractedData && selectedLiquidationId && (
          <div className="space-y-6">
            <Card className="bg-primary/5 border-primary">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Confirmar asociación</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Se asociará la factura <strong>{extractedData.invoice_number}</strong> con 
                      la liquidación <strong>{candidates.find(c => c.id === selectedLiquidationId)?.code || liquidations?.find(l => l.id === selectedLiquidationId)?.code}</strong>
                    </p>
                    <div className="mt-3 p-3 bg-background rounded-lg">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Total factura:</span>
                          <span className="ml-2 font-medium">{formatCurrency(extractedData.total_amount)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total liquidación:</span>
                          <span className="ml-2 font-medium">
                            {formatCurrency(
                              candidates.find(c => c.id === selectedLiquidationId)?.total_amount || 
                              liquidations?.find(l => l.id === selectedLiquidationId)?.total_amount || 0
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPhase('review')}>
                Volver
              </Button>
              <Button onClick={handleConfirm} disabled={isUploading}>
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Confirmar
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
