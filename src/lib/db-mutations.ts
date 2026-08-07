import { toast } from 'sonner';

interface MutationMeta {
  entity: string;
  action?: 'eliminar' | 'actualizar';
}

/**
 * Ejecuta un builder de Supabase que ya incluya `.select()` y comprueba
 * que ha afectado al menos una fila. Evita el "éxito silencioso" cuando
 * la RLS deniega la operación (PostgREST devuelve 200 con [] y sin error).
 *
 * Uso exclusivo para borrados y acciones explícitas del usuario.
 */
export async function mustAffectRows<T>(
  builder: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  { entity, action = 'eliminar' }: MutationMeta,
): Promise<T[]> {
  const { data, error } = await builder;

  if (error) throw new Error(error.message);

  if (!data || data.length === 0) {
    throw new Error(
      `No se pudo ${action} ${entity}: no tienes permiso o el registro ya no existe.`,
    );
  }

  return data;
}

export function reportMutationError(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  toast.error(message);
}
