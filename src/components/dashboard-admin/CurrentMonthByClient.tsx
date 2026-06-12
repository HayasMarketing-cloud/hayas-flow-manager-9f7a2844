import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight, ChevronDown, ExternalLink, Calendar } from 'lucide-react';
import { useCurrentMonthByClient } from '@/hooks/useDashboardAdmin';
import { formatCurrency } from '@/lib/request-utils';

export const CurrentMonthByClient = () => {
  const { data, isLoading } = useCurrentMonthByClient();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (k: string) => {
    setCollapsed(prev => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4 text-primary" />
          Mes en curso — agrupado por cliente
          {data && <Badge variant="secondary">{data.reduce((a, c) => a + c.totalRequests, 0)} requests</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin requests este mes todavía.</p>
        ) : (
          <div className="space-y-2">
            {data.map(client => {
              const clientCollapsed = collapsed.has(client.client_id);
              return (
                <Collapsible key={client.client_id} open={!clientCollapsed} onOpenChange={() => toggle(client.client_id)}>
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted text-left">
                      <div className="flex items-center gap-2">
                        {clientCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        <span className="font-medium">{client.client_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="outline">{client.origins.length} origen(es)</Badge>
                        <Badge variant="outline">{client.totalRequests} req</Badge>
                        <Badge variant="secondary">{formatCurrency(client.totalAmount)}</Badge>
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-6 mt-1 space-y-1">
                    {client.origins.map(origin => {
                      const oKey = `${client.client_id}:${origin.key}`;
                      const oCollapsed = collapsed.has(oKey);
                      const originLink = origin.type === 'budget' ? `/presupuestos/${origin.id}`
                        : origin.type === 'contract' ? `/contratos` : null;
                      return (
                        <Collapsible key={oKey} open={!oCollapsed} onOpenChange={() => toggle(oKey)}>
                          <CollapsibleTrigger asChild>
                            <button className="w-full flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/60 text-left text-sm">
                              <div className="flex items-center gap-2 min-w-0">
                                {oCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                <Badge variant={origin.type === 'budget' ? 'default' : origin.type === 'contract' ? 'secondary' : 'outline'} className="text-[10px]">
                                  {origin.type === 'budget' ? 'Presupuesto' : origin.type === 'contract' ? 'Contrato' : 'Sin origen'}
                                </Badge>
                                {origin.code && <span className="font-mono text-xs">{origin.code}</span>}
                                <span className="truncate text-muted-foreground">{origin.title}</span>
                                {origin.status && <Badge variant="outline" className="text-[10px]">{origin.status}</Badge>}
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <Badge variant="outline">{origin.requests.length} req</Badge>
                                <Badge variant="secondary">{formatCurrency(origin.totalAmount)}</Badge>
                                {originLink && (
                                  <Link to={originLink} onClick={(e) => e.stopPropagation()} className="text-primary">
                                    <ExternalLink className="h-3 w-3" />
                                  </Link>
                                )}
                              </div>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pl-6 space-y-1">
                            {origin.requests.map(req => (
                              <div key={req.id} className="flex items-center justify-between gap-2 p-1.5 rounded hover:bg-muted/40 text-sm">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-mono text-xs">{req.code}</span>
                                  <span className="truncate">{req.title}</span>
                                  <span className="text-xs text-muted-foreground">· {req.specialist?.name ?? 'Sin especialista'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                  <Badge variant="outline">{req.status}</Badge>
                                  <span className="text-muted-foreground">{formatCurrency(Number(req.sale_amount ?? 0))}</span>
                                  <Link to={`/solicitudes/${req.id}`} className="text-primary">
                                    <ExternalLink className="h-3 w-3" />
                                  </Link>
                                </div>
                              </div>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
