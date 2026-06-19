import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ShieldCheck, AlertTriangle, Send, Clock, Check, X } from 'lucide-react';
import { useLiquidationAmReviews, AmReview } from '@/hooks/useLiquidationAmReviews';
import { useUserRole } from '@/hooks/useUserRole';

interface Props {
  liquidationId: string;
}

const statusMeta: Record<AmReview['status'], { label: string; cls: string; icon: any }> = {
  pending: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: Clock },
  validated: { label: 'Validado', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: Check },
  issue: { label: 'Incidencia', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: AlertTriangle },
};

export function LiquidationAmReviewPanel({ liquidationId }: Props) {
  const { canAccessFinance } = useUserRole();
  const {
    reviews, myReview, total, validated, isLoading,
    sendForValidation, respondAsAm, aggregateStatus,
  } = useLiquidationAmReviews(liquidationId);
  const [notes, setNotes] = useState(myReview?.notes || '');

  // Re-sync notes when myReview changes (e.g. after refetch)
  if (myReview && notes === '' && myReview.notes && myReview.notes !== notes) {
    setNotes(myReview.notes);
  }

  const isAdmin = canAccessFinance();
  const hasReviews = total > 0;

  if (!isAdmin && !myReview) {
    // No reviews and user is not AM nor admin — nothing to show
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Validación Account Manager
          </span>
          {hasReviews && (
            <AggregateBadge status={aggregateStatus} validated={validated} total={total} />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdmin && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {hasReviews
                ? 'Reenvía la solicitud a los AM pendientes si lo necesitas.'
                : 'Envía esta liquidación a los AM implicados para que la validen.'}
            </p>
            <Button
              size="sm"
              variant={hasReviews ? 'outline' : 'default'}
              onClick={() => sendForValidation.mutate()}
              disabled={sendForValidation.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              {sendForValidation.isPending ? 'Enviando...' : hasReviews ? 'Reenviar a AM' : 'Enviar a AM'}
            </Button>
          </div>
        )}

        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

        {hasReviews && (
          <div className="space-y-2">
            {reviews.map(r => {
              const meta = statusMeta[r.status];
              const Icon = meta.icon;
              return (
                <div key={r.id} className="flex items-start justify-between gap-3 p-3 border rounded-md">
                  <div className="min-w-0">
                    <div className="font-medium text-sm">
                      {r.am?.full_name || r.am?.email || 'AM'}
                    </div>
                    {r.am?.email && r.am?.full_name && (
                      <div className="text-xs text-muted-foreground">{r.am.email}</div>
                    )}
                    {r.notes && (
                      <div className="mt-2 text-sm bg-muted/50 rounded px-2 py-1 whitespace-pre-wrap">
                        {r.notes}
                      </div>
                    )}
                    {r.reviewed_at && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Respondido: {new Date(r.reviewed_at).toLocaleString('es-ES')}
                      </div>
                    )}
                  </div>
                  <Badge className={meta.cls + ' shrink-0'}>
                    <Icon className="h-3 w-3 mr-1" />
                    {meta.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}

        {myReview && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="text-sm font-medium">Tu validación</div>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Notas o comentarios (opcional)"
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => respondAsAm.mutate({ status: 'validated', notes })}
                  disabled={respondAsAm.isPending}
                >
                  <Check className="h-4 w-4 mr-1" /> Validar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => respondAsAm.mutate({ status: 'issue', notes })}
                  disabled={respondAsAm.isPending}
                >
                  <X className="h-4 w-4 mr-1" /> Marcar incidencia
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AggregateBadge({ status, validated, total }: { status: string; validated: number; total: number }) {
  if (status === 'validated') return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Validado AM ✓</Badge>;
  if (status === 'issue') return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">Incidencia AM</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Pendiente AM ({validated}/{total})</Badge>;
}
