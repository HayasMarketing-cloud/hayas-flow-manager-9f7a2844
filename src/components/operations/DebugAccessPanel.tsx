import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useAssignedClients } from '@/hooks/useAssignedClients';
import { useCurrentSpecialist } from '@/hooks/useCurrentSpecialist';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bug, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface DiagnosticResult {
  projectsCount: number | null;
  requestsCount: number | null;
  projectsError: string | null;
  requestsError: string | null;
}

export function DebugAccessPanel() {
  const [searchParams] = useSearchParams();
  const isDebugMode = searchParams.get('debug') === '1';
  
  const { user } = useAuth();
  const { 
    roles, 
    loading: rolesLoading, 
    isAdmin, 
    canAccessFinance, 
    isAccountManager, 
    isProjectManager, 
    isSpecialist,
    shouldFilterByAssignment 
  } = useUserRole();
  const { assignedClientIds, isLoading: assignedLoading, needsFiltering } = useAssignedClients();
  const { specialistId, isLoading: specialistLoading } = useCurrentSpecialist();
  
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const result: DiagnosticResult = {
      projectsCount: null,
      requestsCount: null,
      projectsError: null,
      requestsError: null,
    };

    try {
      // Test projects query
      const { count: projectsCount, error: projectsError } = await supabase
        .from('operational_projects')
        .select('id', { count: 'exact', head: true });
      
      if (projectsError) {
        result.projectsError = `${projectsError.code}: ${projectsError.message}`;
      } else {
        result.projectsCount = projectsCount;
      }
    } catch (e: any) {
      result.projectsError = e.message;
    }

    try {
      // Test requests query
      const { count: requestsCount, error: requestsError } = await supabase
        .from('operational_requests')
        .select('id', { count: 'exact', head: true });
      
      if (requestsError) {
        result.requestsError = `${requestsError.code}: ${requestsError.message}`;
      } else {
        result.requestsCount = requestsCount;
      }
    } catch (e: any) {
      result.requestsError = e.message;
    }

    setDiagnostics(result);
    setIsRunning(false);
  };

  useEffect(() => {
    if (isDebugMode && !rolesLoading && !assignedLoading && !specialistLoading) {
      runDiagnostics();
    }
  }, [isDebugMode, rolesLoading, assignedLoading, specialistLoading]);

  if (!isDebugMode) return null;

  const anyLoading = rolesLoading || assignedLoading || specialistLoading;

  return (
    <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Bug className="h-4 w-4" />
              Panel de Diagnóstico de Acceso
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={runDiagnostics} 
                disabled={isRunning || anyLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {expanded ? 'Minimizar' : 'Expandir'}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="pt-2 space-y-4 text-sm">
            {anyLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando información de acceso...
              </div>
            ) : (
              <>
                {/* User Identity */}
                <div className="space-y-1">
                  <div className="font-medium text-amber-800 dark:text-amber-300">Usuario</div>
                  <div className="font-mono text-xs bg-white dark:bg-black/20 p-2 rounded">
                    <div>Email: {user?.email || 'N/A'}</div>
                    <div>ID: {user?.id || 'N/A'}</div>
                  </div>
                </div>

                {/* Roles */}
                <div className="space-y-1">
                  <div className="font-medium text-amber-800 dark:text-amber-300">Roles</div>
                  <div className="flex flex-wrap gap-1">
                    {roles.length === 0 ? (
                      <Badge variant="destructive">Sin roles</Badge>
                    ) : (
                      roles.map(role => (
                        <Badge key={role} variant="secondary">{role}</Badge>
                      ))
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    isAdmin: {isAdmin() ? '✅' : '❌'} | 
                    canAccessFinance: {canAccessFinance() ? '✅' : '❌'} | 
                    isAM: {isAccountManager() ? '✅' : '❌'} | 
                    isPM: {isProjectManager() ? '✅' : '❌'} | 
                    isSpecialist: {isSpecialist() ? '✅' : '❌'}
                  </div>
                </div>

                {/* Filtering Logic */}
                <div className="space-y-1">
                  <div className="font-medium text-amber-800 dark:text-amber-300">Lógica de Filtrado</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white dark:bg-black/20 p-2 rounded">
                      <span className="text-muted-foreground">needsFiltering:</span>{' '}
                      <span className={needsFiltering ? 'text-amber-600' : 'text-green-600'}>
                        {needsFiltering ? 'true (filtrando)' : 'false (ve todo)'}
                      </span>
                    </div>
                    <div className="bg-white dark:bg-black/20 p-2 rounded">
                      <span className="text-muted-foreground">shouldFilterByAssignment:</span>{' '}
                      {shouldFilterByAssignment() ? 'true' : 'false'}
                    </div>
                  </div>
                </div>

                {/* Assigned Clients (AM/PM) */}
                <div className="space-y-1">
                  <div className="font-medium text-amber-800 dark:text-amber-300">
                    Clientes Asignados (AM/PM)
                  </div>
                  <div className="bg-white dark:bg-black/20 p-2 rounded text-xs">
                    {assignedClientIds.length === 0 ? (
                      <div className="flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="h-3 w-3" />
                        Sin clientes asignados
                        {needsFiltering && ' (esto puede causar vista vacía)'}
                      </div>
                    ) : (
                      <div>
                        <span className="text-green-600">{assignedClientIds.length} cliente(s)</span>
                        <div className="font-mono mt-1 text-[10px] max-h-20 overflow-auto">
                          {assignedClientIds.join(', ')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Specialist Link */}
                <div className="space-y-1">
                  <div className="font-medium text-amber-800 dark:text-amber-300">
                    Vínculo Especialista
                  </div>
                  <div className="bg-white dark:bg-black/20 p-2 rounded text-xs">
                    {specialistId ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        ID: <span className="font-mono">{specialistId}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-amber-600">
                        <XCircle className="h-3 w-3" />
                        No vinculado a un registro de especialista
                        {isSpecialist() && ' (esto afecta visibilidad como especialista)'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Database Probe Results */}
                <div className="space-y-1">
                  <div className="font-medium text-amber-800 dark:text-amber-300">
                    Resultados de Consulta (RLS aplicada)
                  </div>
                  {diagnostics ? (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white dark:bg-black/20 p-2 rounded">
                        <div className="text-muted-foreground">operational_projects:</div>
                        {diagnostics.projectsError ? (
                          <div className="text-red-600">{diagnostics.projectsError}</div>
                        ) : (
                          <div className={diagnostics.projectsCount === 0 ? 'text-amber-600' : 'text-green-600'}>
                            {diagnostics.projectsCount} filas visibles
                          </div>
                        )}
                      </div>
                      <div className="bg-white dark:bg-black/20 p-2 rounded">
                        <div className="text-muted-foreground">operational_requests:</div>
                        {diagnostics.requestsError ? (
                          <div className="text-red-600">{diagnostics.requestsError}</div>
                        ) : (
                          <div className={diagnostics.requestsCount === 0 ? 'text-amber-600' : 'text-green-600'}>
                            {diagnostics.requestsCount} filas visibles
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      {isRunning ? 'Ejecutando...' : 'No ejecutado'}
                    </div>
                  )}
                </div>

                {/* Interpretation */}
                {diagnostics && (
                  <div className="p-2 bg-white dark:bg-black/20 rounded text-xs border-l-4 border-amber-500">
                    <div className="font-medium mb-1">Interpretación:</div>
                    {diagnostics.projectsCount === 0 && diagnostics.requestsCount === 0 ? (
                      needsFiltering && assignedClientIds.length === 0 ? (
                        <span className="text-amber-600">
                          AM/PM sin clientes asignados. Necesitas ser asignado como AM o PM en un contrato o presupuesto.
                        </span>
                      ) : isSpecialist() && !specialistId ? (
                        <span className="text-amber-600">
                          Especialista sin vínculo. Tu usuario no está vinculado a un registro en la tabla de especialistas.
                        </span>
                      ) : (
                        <span className="text-red-600">
                          RLS está bloqueando el acceso o no hay datos en el sistema.
                        </span>
                      )
                    ) : (
                      <span className="text-green-600">
                        Las consultas a la base de datos devuelven datos. Si la UI está vacía, el problema está en el filtrado del frontend.
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
