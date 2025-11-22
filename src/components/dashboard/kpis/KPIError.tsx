import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface KPIErrorProps {
  onRetry?: () => void;
}

export const KPIError = ({ onRetry }: KPIErrorProps) => {
  return (
    <Card className="border-destructive/20">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center justify-center text-center space-y-2">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">Error al cargar datos</p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Reintentar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
