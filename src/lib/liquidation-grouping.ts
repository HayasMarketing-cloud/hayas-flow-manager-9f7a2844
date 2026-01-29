// Utility for grouping liquidation items by Client → Project/Budget hierarchy

export interface GroupedProjectBudget {
  id: string;
  name: string;
  type: 'project' | 'budget' | 'none';
  items: any[];
  subtotal: number;
}

export interface GroupedClient {
  clientId: string;
  clientName: string;
  projectBudgets: GroupedProjectBudget[];
  subtotal: number;
}

/**
 * Groups liquidation items hierarchically: Client → Project/Budget → Items
 * Manual concepts (no financial_request) are grouped under "Otros conceptos"
 */
export const groupItemsByClientAndProject = (items: any[]): GroupedClient[] => {
  const clientMap = new Map<string, GroupedClient>();

  items.forEach((item) => {
    // Determine client
    const clientId = item.financial_request?.client?.id || 'no-client';
    const clientName = item.financial_request?.client?.name || 
      (item.financial_request_id ? 'Sin cliente' : 'Otros conceptos');

    // Determine project or budget
    const opRequest = item.financial_request?.operational_request?.[0];
    const project = opRequest?.operational_project;
    const budget = item.financial_request?.budget;

    let projectBudgetId = 'no-project';
    let projectBudgetName = 'Sin proyecto/presupuesto';
    let projectBudgetType: 'project' | 'budget' | 'none' = 'none';

    if (project) {
      projectBudgetId = project.id;
      projectBudgetName = project.name;
      projectBudgetType = 'project';
    } else if (budget) {
      projectBudgetId = budget.id;
      projectBudgetName = budget.title || budget.code;
      projectBudgetType = 'budget';
    }

    // Get or create client group
    if (!clientMap.has(clientId)) {
      clientMap.set(clientId, {
        clientId,
        clientName,
        projectBudgets: [],
        subtotal: 0,
      });
    }
    const clientGroup = clientMap.get(clientId)!;

    // Find or create project/budget group within client
    let projectGroup = clientGroup.projectBudgets.find(p => p.id === projectBudgetId);
    if (!projectGroup) {
      projectGroup = {
        id: projectBudgetId,
        name: projectBudgetName,
        type: projectBudgetType,
        items: [],
        subtotal: 0,
      };
      clientGroup.projectBudgets.push(projectGroup);
    }

    // Add item to project group
    const itemTotal = Number(item.total) || 0;
    projectGroup.items.push(item);
    projectGroup.subtotal += itemTotal;
    clientGroup.subtotal += itemTotal;
  });

  // Sort everything
  const result = Array.from(clientMap.values());

  // Sort clients: "Otros conceptos" last, rest alphabetically
  result.sort((a, b) => {
    if (a.clientId === 'no-client' && !a.clientName.includes('Otros')) return 1;
    if (b.clientId === 'no-client' && !b.clientName.includes('Otros')) return -1;
    if (a.clientName === 'Otros conceptos') return 1;
    if (b.clientName === 'Otros conceptos') return -1;
    return a.clientName.localeCompare(b.clientName);
  });

  // Sort projects within each client and items within each project
  result.forEach(client => {
    // Sort projects: "Sin proyecto" last, rest alphabetically
    client.projectBudgets.sort((a, b) => {
      if (a.type === 'none') return 1;
      if (b.type === 'none') return -1;
      return a.name.localeCompare(b.name);
    });

    // Sort items within each project by code
    client.projectBudgets.forEach(project => {
      project.items.sort((a, b) => {
        const codeA = a.financial_request?.code || '';
        const codeB = b.financial_request?.code || '';
        return codeA.localeCompare(codeB);
      });
    });
  });

  return result;
};

/**
 * Calculate the total for a list of items
 */
export const calculateItemsTotal = (items: any[]): number => {
  return items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
};
