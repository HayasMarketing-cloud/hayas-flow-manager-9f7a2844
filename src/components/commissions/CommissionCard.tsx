import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Pencil, User, FileText, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Commission {
  id: string;
  seller_user_id: string;
  contract_id: string | null;
  budget_id: string | null;
  commission_percentage: number;
  commission_amount: number;
  base_amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  notes: string | null;
  seller_profile?: { full_name: string; email: string } | null;
  contract?: { title: string; code: string; client?: { name: string } | null } | null;
  budget?: { title: string; code: string; client?: { name: string } | null } | null;
}

interface CommissionCardProps {
  commission: Commission;
  onView: () => void;
  onEdit: () => void;
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
}

export function CommissionCard({
  commission,
  onView,
  onEdit,
  statusLabels,
  statusColors,
}: CommissionCardProps) {
  const source = commission.contract || commission.budget;
  const sourceType = commission.contract_id ? 'Contrato' : 'Presupuesto';
  const sourceCode = commission.contract?.code || commission.budget?.code || '';
  const clientName = source?.client?.name || 'Sin cliente';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              {commission.commission_amount.toLocaleString('es-ES', {
                style: 'currency',
                currency: 'EUR',
              })}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {commission.commission_percentage}% de {commission.base_amount.toLocaleString('es-ES', {
                style: 'currency',
                currency: 'EUR',
              })}
            </p>
          </div>
          <Badge className={statusColors[commission.status]}>
            {statusLabels[commission.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span>{commission.seller_profile?.full_name || 'Sin asignar'}</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <div>
            <span className="font-medium">{sourceType}:</span>{' '}
            <span className="text-muted-foreground">{sourceCode}</span>
          </div>
        </div>
        
        <div className="text-sm text-muted-foreground">
          Cliente: {clientName}
        </div>

        <div className="text-xs text-muted-foreground">
          Creada: {format(new Date(commission.created_at), "d MMM yyyy", { locale: es })}
          {commission.paid_at && (
            <span className="ml-2">
              • Pagada: {format(new Date(commission.paid_at), "d MMM yyyy", { locale: es })}
            </span>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onView}>
            <Eye className="h-4 w-4 mr-1" />
            Ver
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-1" />
            Editar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
