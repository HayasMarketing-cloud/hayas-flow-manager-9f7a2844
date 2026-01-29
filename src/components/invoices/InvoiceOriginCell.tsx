import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { FolderKanban, FileSpreadsheet, ScrollText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface OriginItem {
  id: string;
  name?: string;
  code?: string;
  title?: string;
}

interface InvoiceOriginCellProps {
  items: OriginItem[];
  type: 'project' | 'budget' | 'contract';
}

const getConfig = (type: InvoiceOriginCellProps['type']) => {
  switch (type) {
    case 'project':
      return {
        icon: FolderKanban,
        color: 'text-emerald-600',
        label: 'Proyecto',
        basePath: '/operaciones/proyectos',
        getLabel: (item: OriginItem) => item.name || item.title || item.id,
      };
    case 'budget':
      return {
        icon: FileSpreadsheet,
        color: 'text-primary',
        label: 'Presupuesto',
        basePath: '/presupuestos',
        getLabel: (item: OriginItem) => item.code || item.title || item.id,
      };
    case 'contract':
      return {
        icon: ScrollText,
        color: 'text-blue-600',
        label: 'Contrato',
        basePath: '/contratos',
        getLabel: (item: OriginItem) => item.title || item.code || item.id,
      };
  }
};

export const InvoiceOriginCell = ({ items, type }: InvoiceOriginCellProps) => {
  const navigate = useNavigate();
  const config = getConfig(type);
  const Icon = config.icon;

  if (!items || items.length === 0) {
    return <span className="text-muted-foreground text-sm">---</span>;
  }

  const firstItem = items[0];
  const remaining = items.length - 1;
  const label = config.getLabel(firstItem);

  const handleClick = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    navigate(`${config.basePath}/${itemId}`);
  };

  if (items.length === 1) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={(e) => handleClick(e, firstItem.id)}
            className={`flex items-center gap-1.5 text-xs ${config.color} hover:underline cursor-pointer max-w-[100px]`}
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.label}: {label}</p>
          <p className="text-xs text-muted-foreground">Clic para ver detalles</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Multiple items
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => handleClick(e, firstItem.id)}
            className={`flex items-center gap-1.5 text-xs ${config.color} hover:underline cursor-pointer max-w-[80px]`}
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{label}</span>
          </button>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            +{remaining}
          </Badge>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium mb-1">{config.label}s asociados:</p>
        <ul className="text-xs space-y-0.5">
          {items.map((item) => (
            <li key={item.id}>• {config.getLabel(item)}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
};
