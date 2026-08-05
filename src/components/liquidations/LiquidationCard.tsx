import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Pencil, Calendar, Mail, Users } from 'lucide-react';
import { LiquidationStatusBadge } from './LiquidationStatusBadge';
import { SignatureStatusBadge } from './SignatureStatusBadge';
import { formatPeriod, formatCurrency } from '@/lib/liquidation-utils';
import { LiquidationPaymentPlanBadge } from './LiquidationPaymentPlanBadge';

interface LiquidationCardProps {
  liquidation: any;
  onView: (liquidation: any) => void;
  onEdit?: (liquidation: any) => void;
  onSendEmail?: (liquidation: any) => void;
  canManage: boolean;
  isSending?: boolean;
}

export const LiquidationCard = ({ liquidation, onView, onEdit, onSendEmail, canManage, isSending }: LiquidationCardProps) => {
  const isEditable = liquidation.status !== 'paid';
  const hasSpecialistEmail = !!liquidation.specialist?.email;
  // Get latest signature (first one in array, sorted by created_at desc)
  const latestSignature = liquidation.liquidation_signatures?.[0] || null;
  
  // Team liquidation properties
  const isTeamLiquidation = liquidation.is_team === true;
  const displayTotal = isTeamLiquidation 
    ? liquidation.team_total 
    : (liquidation.calculated_total ?? liquidation.subtotal ?? liquidation.total_amount);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{liquidation.specialist?.name || 'Sin especialista'}</CardTitle>
              {isTeamLiquidation && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                  <Users className="h-3 w-3 mr-1" />
                  Equipo
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Badge variant="outline" className="w-fit text-xs">
                {formatPeriod(liquidation.period_year, liquidation.period_month, 'short')}
                {liquidation.label ? ` · ${liquidation.label}` : ''}
              </Badge>
              <LiquidationPaymentPlanBadge liquidation={liquidation} total={displayTotal} className="text-xs" />
            </div>
          </div>
          <LiquidationStatusBadge status={liquidation.status} />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          {liquidation.code}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Signature status */}
        {liquidation.status !== 'draft' && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Firma:</span>
            <SignatureStatusBadge signature={latestSignature} />
          </div>
        )}

        {/* Team members info */}
        {isTeamLiquidation && liquidation.team_members?.length > 0 && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Miembros:</span>{' '}
            {liquidation.team_members.map((m: any) => m.name).join(', ')}
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 inline mr-2" />
          Creada: {new Date(liquidation.created_at).toLocaleDateString('es-ES')}
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-muted-foreground">
            {isTeamLiquidation ? 'Total Equipo:' : 'Total:'}
          </span>
          <div className="text-right">
            <span className="text-lg font-bold">{formatCurrency(displayTotal)}</span>
            {isTeamLiquidation && (
              <div className="text-xs text-muted-foreground">
                ({formatCurrency(liquidation.leader_total)} + {formatCurrency((liquidation.team_total || 0) - (liquidation.leader_total || 0))})
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => onView(liquidation)} variant="outline" className="flex-1">
            <Eye className="h-4 w-4 mr-2" />
            Ver
          </Button>
          {canManage && isEditable && onEdit && (
            <Button onClick={() => onEdit(liquidation)} variant="outline" className="flex-1">
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
          {canManage && isEditable && hasSpecialistEmail && onSendEmail && (
            <Button 
              onClick={() => onSendEmail(liquidation)} 
              variant="default"
              className="flex-1"
              disabled={isSending}
            >
              <Mail className="h-4 w-4 mr-2" />
              {isSending ? 'Enviando...' : 'Enviar'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
