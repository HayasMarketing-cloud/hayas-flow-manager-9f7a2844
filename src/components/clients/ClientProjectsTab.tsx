import { ProjectsLensView } from '@/components/projects/ProjectsLensView';

interface Props {
  clientId: string;
  canEdit?: boolean;
}

/**
 * Pestaña Proyectos de la ficha de cliente (F6).
 * Es la misma lente de solo lectura de /proyectos, filtrada por cliente.
 */
export const ClientProjectsTab = ({ clientId }: Props) => {
  return <ProjectsLensView clientId={clientId} />;
};
