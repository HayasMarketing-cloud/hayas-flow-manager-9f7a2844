import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { SignalBadge } from './SignalBadge';
import { requestSignal, type LensRequest } from '@/lib/projects-view-aggregation';
import { REQUEST_STATUS_LABELS } from '@/lib/request-status-utils';
import { formatCurrency } from '@/lib/request-utils';

export const RequestLensRow = ({ request }: { request: LensRequest }) => {
  const navigate = useNavigate();
  const signal = requestSignal(request);

  return (
    <button
      type="button"
      onClick={() => navigate(`/solicitudes/${request.id}`)}
      className="w-full text-left grid grid-cols-12 gap-2 items-center px-3 py-2 rounded-md hover:bg-muted/60 transition-colors"
    >
      <span className="col-span-2 text-xs font-mono text-muted-foreground truncate">{request.code}</span>
      <span className="col-span-4 text-sm truncate">{request.title}</span>
      <span className="col-span-2 text-xs text-muted-foreground truncate">
        {request.specialistName ?? '—'}
      </span>
      <span className="col-span-1 text-xs text-muted-foreground">
        {request.deadline ? new Date(`${request.deadline}T00:00:00`).toLocaleDateString('es-ES') : '—'}
      </span>
      <span className="col-span-1 text-xs text-right text-muted-foreground">
        {request.hours ? `${Number(request.hours)}h` : '—'}
      </span>
      <span className="col-span-1 text-xs text-right text-muted-foreground">
        {formatCurrency(Number(request.sale_amount ?? 0))}
      </span>
      <span className="col-span-1 flex justify-end gap-1">
        <Badge variant="secondary" className="text-[10px]">
          {REQUEST_STATUS_LABELS[request.status]}
        </Badge>
        {signal !== 'none' && <SignalBadge signal={signal} />}
      </span>
    </button>
  );
};
