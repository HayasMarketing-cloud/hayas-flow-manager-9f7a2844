import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface RequestsFlowChartProps {
  data: Array<{
    month: string;
    pending: number;
    inProgress: number;
    completed: number;
  }>;
}

export const RequestsFlowChart = ({ data }: RequestsFlowChartProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Flujo de Solicitudes</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="month" 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
              }}
            />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="pending" 
              stackId="1"
              stroke="hsl(var(--accent))"
              fill="hsl(var(--accent))"
              fillOpacity={0.6}
              name="Pendientes"
            />
            <Area 
              type="monotone" 
              dataKey="inProgress" 
              stackId="1"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.6}
              name="En Progreso"
            />
            <Area 
              type="monotone" 
              dataKey="completed" 
              stackId="1"
              stroke="hsl(217 91% 40%)"
              fill="hsl(217 91% 40%)"
              fillOpacity={0.6}
              name="Completadas"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
