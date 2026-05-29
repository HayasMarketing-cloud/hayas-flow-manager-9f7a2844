// Utility for grouping liquidation items by Client → Project/Budget hierarchy

export interface GroupedProjectBudget {
  id: string;
  name: string;
  type: 'project' | 'budget' | 'contract' | 'none';
  items: any[];
  subtotal: number;
}

export interface GroupedClient {
  clientId: string;
  clientName: string;
  projectBudgets: GroupedProjectBudget[];
  subtotal: number;
}

export interface CommissionSourceInfo {
  type: string;
  percentage: number;
  baseAmount: number;
  invoiceCodes: string[];
  clientId?: string;
  clientName?: string;
  budgetId?: string;
  budgetCode?: string;
  budgetTitle?: string;
  contractId?: string;
  contractCode?: string;
  contractTitle?: string;
}

/**
 * Groups liquidation items hierarchically: Client → Project/Budget → Items
 * Manual concepts (no financial_request) are grouped under "Otros conceptos"
 * Commission items are grouped by their invoice's client/budget when available
 */
export const groupItemsByClientAndProject = (
  items: any[],
  commissionDetails?: Record<string, CommissionSourceInfo>
): GroupedClient[] => {
  const clientMap = new Map<string, GroupedClient>();

  items.forEach((item) => {
    // Check if this is a commission item with enriched source data
    const isCommission = !item.financial_request_id && item.description?.startsWith('Comisión');
    let commissionSource: CommissionSourceInfo | undefined;
    if (isCommission && commissionDetails) {
      // Match commission detail by description content (type label)
      commissionSource = Object.values(commissionDetails).find(d => {
        const typeLabel = d.type === 'am' ? 'AM' : d.type === 'pm' ? 'PM' : 'Venta';
        return item.description?.includes(`Comisión ${typeLabel}`) && 
               Math.abs((d.percentage * d.baseAmount / 100) - Number(item.total)) < 0.02;
      });
    }

    // Determine client
    let clientId = item.financial_request?.client?.id || 'no-client';
    let clientName = item.financial_request?.client?.name || 
      (item.financial_request_id ? 'Sin cliente' : 'Otros conceptos');

    // Override with commission source if available
    if (commissionSource?.clientId) {
      clientId = commissionSource.clientId;
      clientName = commissionSource.clientName || 'Sin cliente';
    }

    // Determine project or budget
    const opRequest = item.financial_request?.operational_request?.[0];
    const project = opRequest?.operational_project;
    const budget = item.financial_request?.budget;
    const contract = item.financial_request?.contract;

    let projectBudgetId = 'no-project';
    let projectBudgetName = 'Sin proyecto/presupuesto';
    let projectBudgetType: 'project' | 'budget' | 'contract' | 'none' = 'none';

    if (project) {
      projectBudgetId = project.id;
      projectBudgetName = project.name;
      projectBudgetType = 'project';
    } else if (budget) {
      projectBudgetId = budget.id;
      projectBudgetName = budget.title || budget.code;
      projectBudgetType = 'budget';
    } else if (contract) {
      projectBudgetId = contract.id;
      projectBudgetName = contract.title || contract.code;
      projectBudgetType = 'contract';
    } else if (commissionSource?.budgetId) {
      projectBudgetId = commissionSource.budgetId;
      projectBudgetName = commissionSource.budgetTitle || commissionSource.budgetCode || 'Presupuesto';
      projectBudgetType = 'budget';
    } else if (commissionSource?.contractId) {
      projectBudgetId = commissionSource.contractId;
      projectBudgetName = commissionSource.contractTitle || commissionSource.contractCode || 'Contrato';
      projectBudgetType = 'contract';
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

    // Add item to project group. Use `?? 0` (not `|| 0`) so legitimate
    // negative manual adjustments are preserved.
    const rawTotal = Number(item.total);
    const itemTotal = Number.isFinite(rawTotal) ? rawTotal : 0;
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

// NOTE: total computation lives in `liquidation-totals.ts` to keep a
// single source of truth shared by the UI and the PDF generator.

