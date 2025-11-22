import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DashboardAlert } from '@/hooks/useDashboardAlerts';

interface AlertsWidgetProps {
  alerts: DashboardAlert[] | undefined;
  isLoading: boolean;
}

export const AlertsWidget = ({ alerts, isLoading }: AlertsWidgetProps) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Alertas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </CardContent>
      </Card>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Alertas</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Todo en orden</p>
        </CardContent>
      </Card>
    );
  }

  const getIcon = (type: DashboardAlert['type']) => {
    switch (type) {
      case 'critical':
        return AlertCircle;
      case 'warning':
        return AlertTriangle;
      case 'info':
        return Info;
    }
  };

  const getVariant = (type: DashboardAlert['type']) => {
    switch (type) {
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'default';
      case 'info':
        return 'default';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alertas ({alerts.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => {
          const Icon = getIcon(alert.type);
          return (
            <Alert key={alert.id} variant={getVariant(alert.type)}>
              <Icon className="h-4 w-4" />
              <AlertTitle>{alert.title}</AlertTitle>
              <AlertDescription>
                {alert.description}
                {alert.action && (
                  <Button
                    variant="link"
                    onClick={() => navigate(alert.action!.path)}
                    className="p-0 h-auto ml-2"
                  >
                    {alert.action.label} →
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          );
        })}
      </CardContent>
    </Card>
  );
};
