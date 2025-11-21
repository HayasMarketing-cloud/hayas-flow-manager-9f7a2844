import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Briefcase, UserCheck, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const Dashboard = () => {
  const [stats, setStats] = useState({
    clients: 0,
    services: 0,
    specialists: 0,
    contracts: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      const [clients, services, specialists, contracts] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('services').select('*', { count: 'exact', head: true }),
        supabase.from('specialists').select('*', { count: 'exact', head: true }),
        supabase.from('contracts').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        clients: clients.count || 0,
        services: services.count || 0,
        specialists: specialists.count || 0,
        contracts: contracts.count || 0,
      });
    };

    fetchStats();
  }, []);

  const cards = [
    { title: 'Clientes', value: stats.clients, icon: Users, color: 'text-blue-500' },
    { title: 'Servicios', value: stats.services, icon: Briefcase, color: 'text-green-500' },
    { title: 'Especialistas', value: stats.specialists, icon: UserCheck, color: 'text-purple-500' },
    { title: 'Contratos', value: stats.contracts, icon: FileText, color: 'text-orange-500' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Vista general del sistema</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{card.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
