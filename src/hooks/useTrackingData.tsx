import { useMemo } from 'react';
import { MilestoneWithDetails, useProjectMilestones, MilestoneFilters } from './useProjectMilestones';

export interface ProjectGroup {
  project: {
    id: string;
    name: string;
    status: string | null;
    deadline: string | null;
    client: { id: string; name: string } | null;
    contract: { id: string; title: string; code: string } | null;
    budget: { id: string; title: string; code: string; estimated_invoice_date: string | null } | null;
  };
  milestones: MilestoneWithDetails[];
  stats: { total: number; completed: number };
}

export const useTrackingData = (filters?: MilestoneFilters) => {
  const { data: milestones, isLoading, error } = useProjectMilestones(filters);

  const projectGroups = useMemo((): ProjectGroup[] => {
    if (!milestones || milestones.length === 0) return [];

    // Group milestones by operational_project_id
    const groupsMap = new Map<string, ProjectGroup>();

    milestones.forEach((milestone) => {
      const projectId = milestone.operational_project_id;
      const project = milestone.operational_project;

      if (!project) return;

      if (!groupsMap.has(projectId)) {
        groupsMap.set(projectId, {
          project: {
            id: project.id,
            name: project.name,
            status: project.status,
            deadline: project.deadline,
            client: project.client,
            contract: project.contract,
            budget: project.budget,
          },
          milestones: [],
          stats: { total: 0, completed: 0 },
        });
      }

      const group = groupsMap.get(projectId)!;
      group.milestones.push(milestone);
      group.stats.total++;
      if (milestone.status === 'completed') {
        group.stats.completed++;
      }
    });

    // Convert to array and sort by project name
    return Array.from(groupsMap.values()).sort((a, b) => 
      a.project.name.localeCompare(b.project.name)
    );
  }, [milestones]);

  return {
    projectGroups,
    milestones,
    isLoading,
    error,
    totalProjects: projectGroups.length,
    totalMilestones: milestones?.length || 0,
  };
};
