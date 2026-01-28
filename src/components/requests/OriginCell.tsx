import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { FileSpreadsheet, FolderKanban, ScrollText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface OriginCellProps {
  budgetId?: string | null;
  budgetCode?: string | null;
  contractId?: string | null;
  contractTitle?: string | null;
  operationalProject?: {
    id: string;
    name: string;
  } | null;
}

export const OriginCell = ({ 
  budgetId, 
  budgetCode, 
  contractId, 
  contractTitle, 
  operationalProject 
}: OriginCellProps) => {
  const navigate = useNavigate();
  
  const hasBudget = budgetId && budgetCode;
  const hasContract = contractId && contractTitle && !hasBudget; // Solo mostrar contrato si no hay presupuesto
  const hasProject = operationalProject?.id && operationalProject?.name;
  
  if (!hasBudget && !hasContract && !hasProject) {
    return <span className="text-muted-foreground text-sm">---</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      {hasBudget && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/presupuestos/${budgetId}`);
              }}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline cursor-pointer max-w-[120px]"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate font-mono">{budgetCode}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Presupuesto: {budgetCode}</p>
            <p className="text-xs text-muted-foreground">Clic para ver detalles</p>
          </TooltipContent>
        </Tooltip>
      )}
      
      {hasContract && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/contratos`);
              }}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline cursor-pointer max-w-[120px]"
            >
              <ScrollText className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{contractTitle}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Contrato: {contractTitle}</p>
            <p className="text-xs text-muted-foreground">Clic para ver contratos</p>
          </TooltipContent>
        </Tooltip>
      )}
      
      {hasProject && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/operaciones/proyectos/${operationalProject.id}`);
              }}
              className="flex items-center gap-1.5 text-xs text-emerald-600 hover:underline cursor-pointer max-w-[120px]"
            >
              <FolderKanban className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{operationalProject.name}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Proyecto: {operationalProject.name}</p>
            <p className="text-xs text-muted-foreground">Clic para ver detalles</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};
