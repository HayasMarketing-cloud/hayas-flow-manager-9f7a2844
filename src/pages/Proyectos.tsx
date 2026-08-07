import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectsLensView } from '@/components/projects/ProjectsLensView';

/**
 * Vista "Proyectos" (F6): lente de solo lectura sobre `financial_requests`.
 * No hay entidad proyecto persistida ni controles de escritura en esta pantalla.
 */
export default function Proyectos() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Proyectos</h1>
          <p className="text-sm text-muted-foreground">
            Vista agregada de los requests por origen y fase. Solo lectura: el trabajo se gestiona desde cada request.
          </p>
        </div>
        <ProjectsLensView />
      </div>
    </AppLayout>
  );
}
