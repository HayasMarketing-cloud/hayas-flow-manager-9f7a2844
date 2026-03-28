import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Wallet, FileCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { DashboardAlert } from '@/hooks/useDashboardAlerts';

interface QuickActionsWidgetProps {
  alerts: DashboardAlert[] | undefined;
}

export const QuickActionsWidget = ({ alerts }: QuickActionsWidgetProps) => {
  const navigate = useNavigate();
  const { canAccessFinance, isSpecialist } = useUserRole();

  const actions = [];

  if (canAccessFinance()) {
    const hasUnbilledRequests = alerts?.some((a) => a.id === 'unbilled-requests');
    
    if (hasUnbilledRequests) {
      actions.push({
        label: 'Generar facturas',
        icon: FileText,
        onClick: () => navigate('/solicitudes'),
        variant: 'default' as const,
      });
    }

    actions.push({
      label: 'Nueva factura',
      icon: Plus,
      onClick: () => navigate('/facturas'),
      variant: 'outline' as const,
    });

    actions.push({
      label: 'Nueva liquidación',
      icon: Wallet,
      onClick: () => navigate('/liquidaciones'),
      variant: 'outline' as const,
    });
  }

  if (isSpecialist()) {
    actions.push({
      label: 'Mis liquidaciones',
      icon: Wallet,
      onClick: () => navigate('/mis-liquidaciones'),
      variant: 'outline' as const,
    });
  }

  actions.push({
    label: 'Nueva solicitud',
    icon: FileCheck,
    onClick: () => navigate('/solicitudes'),
    variant: 'outline' as const,
  });

  if (actions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Acciones Rápidas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.variant}
            className="w-full justify-start"
            onClick={action.onClick}
          >
            <action.icon className="h-4 w-4 mr-2" />
            {action.label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
};
