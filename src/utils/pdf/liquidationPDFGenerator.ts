import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getMonthName } from '@/lib/liquidation-utils';

interface PendingRequest {
  id: string;
  code: string;
  title: string;
  status: string;
  cost_to_agency: number | null;
  client?: { id: string; name: string } | null;
  budget?: { id: string; code: string; title?: string } | null;
  operational_request?: { id: string; operational_project?: { id: string; name: string } | null }[] | null;
}

interface TeamMemberLiquidation {
  specialist: { name: string };
  liquidation_items: any[];
  calculated_total: number;
  code: string;
}

interface LiquidationData {
  liquidation: any;
  items: any[];
  specialist: any;
  pendingRequests?: PendingRequest[];
  companyInfo?: {
    name: string;
    tradeName?: string;
    address: string;
    phone: string;
    email: string;
  };
  teamData?: {
    members: TeamMemberLiquidation[];
    teamTotal: number;
  };
}

export const generateLiquidationPDF = async (data: LiquidationData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Información de la empresa (APPS 4 BUSINESS SL - HAYAS MARKETING)
  const company = data.companyInfo || {
    name: 'APPS 4 BUSINESS SL',
    tradeName: 'HAYAS MARKETING',
    address: 'C/Manzanares 4 - 28005 Madrid',
    phone: '672 288 182',
    email: 'administracion@hayas.es',
  };

  // Cargar logo
  try {
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      logoImg.onload = () => resolve();
      logoImg.onerror = reject;
      logoImg.src = '/images/hayas-logo.png';
    });
    doc.addImage(logoImg, 'PNG', 15, 10, 35, 35);
  } catch (e) {
    console.warn('Could not load logo for PDF');
  }

  // Header - Datos de empresa (al lado del logo)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(company.name, 55, 18);
  doc.text(company.tradeName || '', 55, 24);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(company.address, 55, 31);
  doc.text(`Tel: ${company.phone}`, 55, 37);
  doc.text(company.email, 55, 43);

  // Título - Derecha (LIQUIDACIÓN + Especialista + Mes + Código)
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('LIQUIDACIÓN', pageWidth - 15, 18, { align: 'right' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(data.specialist.name, pageWidth - 15, 26, { align: 'right' });

  const monthName = new Date(data.liquidation.period_year, data.liquidation.period_month - 1)
    .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  doc.text(capitalizedMonth, pageWidth - 15, 33, { align: 'right' });

  doc.setFontSize(10);
  doc.text(data.liquidation.code, pageWidth - 15, 40, { align: 'right' });

  // Línea divisoria
  doc.setLineWidth(0.5);
  doc.line(15, 50, pageWidth - 15, 50);

  let currentY = 58;

  // Check if we have team data with members
  const hasTeamData = data.teamData && data.teamData.members.length > 0;

  if (hasTeamData) {
    // === TEAM LIQUIDATION MODE ===
    
    // Section: Leader's items
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 70, 126);
    doc.text(`TRABAJOS DE ${data.specialist.name.toUpperCase()} - LÍDER DE EQUIPO`, 15, currentY);
    doc.setTextColor(0, 0, 0);
    currentY += 8;

    // Leader's items table
    const leaderGroupedItems = groupItemsByClient(data.items);
    const leaderTableData = buildTableData(leaderGroupedItems);

    autoTable(doc, {
      startY: currentY,
      head: [['Servicio / Cliente', 'Proyecto/Presupuesto', 'Cantidad', 'Precio Unitario', 'Total']],
      body: leaderTableData,
      theme: 'striped',
      headStyles: {
        fillColor: [0, 70, 126],
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 8,
        cellPadding: 4,
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 40 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' },
      },
    });

    // Leader subtotal
    const leaderTotal = calculateItemsTotal(data.items);
    currentY = (doc as any).lastAutoTable.finalY + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Subtotal ${data.specialist.name}:`, pageWidth - 75, currentY);
    doc.text(formatCurrency(leaderTotal), pageWidth - 15, currentY, { align: 'right' });
    currentY += 15;

    // Section: Each team member's items
    for (const member of data.teamData!.members) {
      // Check if we need a new page
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 70, 126);
      doc.text(`TRABAJOS DE ${member.specialist.name.toUpperCase()} - MIEMBRO DEL EQUIPO`, 15, currentY);
      doc.setTextColor(0, 0, 0);
      currentY += 8;

      const memberGroupedItems = groupItemsByClient(member.liquidation_items);
      const memberTableData = buildTableData(memberGroupedItems);

      autoTable(doc, {
        startY: currentY,
        head: [['Servicio / Cliente', 'Proyecto/Presupuesto', 'Cantidad', 'Precio Unitario', 'Total']],
        body: memberTableData,
        theme: 'striped',
        headStyles: {
          fillColor: [100, 100, 100],
          textColor: 255,
          fontSize: 9,
          fontStyle: 'bold',
        },
        styles: {
          fontSize: 8,
          cellPadding: 4,
        },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 40 },
          2: { cellWidth: 20, halign: 'center' },
          3: { cellWidth: 30, halign: 'right' },
          4: { cellWidth: 30, halign: 'right' },
        },
      });

      // Member subtotal
      currentY = (doc as any).lastAutoTable.finalY + 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`Subtotal ${member.specialist.name}:`, pageWidth - 75, currentY);
      doc.text(formatCurrency(member.calculated_total), pageWidth - 15, currentY, { align: 'right' });
      currentY += 15;
    }

    // Team Total
    doc.setLineWidth(0.5);
    doc.line(pageWidth - 100, currentY - 5, pageWidth - 15, currentY - 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL EQUIPO A PAGAR:', pageWidth - 100, currentY + 5);
    doc.text(formatCurrency(data.teamData!.teamTotal), pageWidth - 15, currentY + 5, { align: 'right' });

    currentY += 20;
  } else {
    // === SINGLE LIQUIDATION MODE (original behavior) ===
    const groupedItems = groupItemsByClient(data.items);
    const tableData = buildTableData(groupedItems);

    autoTable(doc, {
      startY: currentY,
      head: [['Servicio / Cliente', 'Proyecto/Presupuesto', 'Cantidad', 'Precio Unitario', 'Total']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [0, 70, 126],
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 9,
        cellPadding: 5,
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 40 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' },
      },
    });

    // Calculate total
    const calculatedTotal = calculateItemsTotal(data.items);

    // Total
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const totalsX = pageWidth - 75;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL A PAGAR:', totalsX, finalY);
    doc.text(formatCurrency(calculatedTotal), pageWidth - 15, finalY, { align: 'right' });

    currentY = finalY;
  }

  // Notas
  if (data.liquidation.notes) {
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Notas:', 15, currentY + 15);
    const splitNotes = doc.splitTextToSize(data.liquidation.notes, pageWidth - 30);
    doc.text(splitNotes, 15, currentY + 22);
  }

  // Sección de solicitudes pendientes - Siempre en nueva página como ANEXO
  if (data.pendingRequests && data.pendingRequests.length > 0) {
    doc.addPage();
    let annexY = 20;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('ANEXO', pageWidth / 2, annexY, { align: 'center' });

    annexY += 12;

    doc.setFontSize(11);
    doc.text('TRABAJOS PENDIENTES PARA PRÓXIMA LIQUIDACIÓN', 15, annexY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('(Trabajos completados o en progreso aún no incluidos en esta liquidación)', 15, annexY + 6);

    const pendingTableData = data.pendingRequests.map(req => [
      req.code || '-',
      (req.title?.substring(0, 30) + (req.title && req.title.length > 30 ? '...' : '')) || '-',
      req.client?.name || '-',
      getProjectOrBudgetName(req),
      req.status === 'completed' ? 'Completado' : 'En progreso',
      formatCurrency(Number(req.cost_to_agency) || 0)
    ]);

    autoTable(doc, {
      startY: annexY + 12,
      head: [['Código', 'Título', 'Cliente', 'Proy./Pres.', 'Estado', 'Importe']],
      body: pendingTableData,
      theme: 'plain',
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [100, 100, 100],
        fontSize: 8,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 40 },
        2: { cellWidth: 30 },
        3: { cellWidth: 30 },
        4: { cellWidth: 22 },
        5: { cellWidth: 28, halign: 'right' },
      },
    });

    const totalPending = data.pendingRequests.reduce(
      (sum, req) => sum + (Number(req.cost_to_agency) || 0), 0
    );
    const pendingFinalY = (doc as any).lastAutoTable.finalY + 5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Total pendiente: ${formatCurrency(totalPending)}`, pageWidth - 15, pendingFinalY, { align: 'right' });
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(
    'Esta liquidación representa los servicios prestados en el período indicado',
    pageWidth / 2,
    pageHeight - 20,
    { align: 'center' }
  );

  // Descargar
  const fileMonthName = getMonthName(data.liquidation.period_month, 'short').toLowerCase();
  doc.save(`liquidacion_${fileMonthName}_${data.liquidation.period_year}_${data.liquidation.code}.pdf`);
};

// Generate PDF as Base64 string for email attachment
export const generateLiquidationPDFBase64 = async (data: LiquidationData): Promise<string> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  const company = data.companyInfo || {
    name: 'APPS 4 BUSINESS SL',
    tradeName: 'HAYAS MARKETING',
    address: 'C/Manzanares 4 - 28005 Madrid',
    phone: '672 288 182',
    email: 'administracion@hayas.es',
  };

  // Cargar logo
  try {
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      logoImg.onload = () => resolve();
      logoImg.onerror = reject;
      logoImg.src = '/images/hayas-logo.png';
    });
    doc.addImage(logoImg, 'PNG', 15, 10, 35, 35);
  } catch (e) {
    console.warn('Could not load logo for PDF');
  }

  // Header
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(company.name, 55, 18);
  doc.text(company.tradeName || '', 55, 24);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(company.address, 55, 31);
  doc.text(`Tel: ${company.phone}`, 55, 37);
  doc.text(company.email, 55, 43);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('LIQUIDACIÓN', pageWidth - 15, 18, { align: 'right' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(data.specialist.name, pageWidth - 15, 26, { align: 'right' });

  const monthName = new Date(data.liquidation.period_year, data.liquidation.period_month - 1)
    .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  doc.text(capitalizedMonth, pageWidth - 15, 33, { align: 'right' });

  doc.setFontSize(10);
  doc.text(data.liquidation.code, pageWidth - 15, 40, { align: 'right' });

  doc.setLineWidth(0.5);
  doc.line(15, 50, pageWidth - 15, 50);

  let currentY = 58;

  const hasTeamData = data.teamData && data.teamData.members.length > 0;

  if (hasTeamData) {
    // === TEAM LIQUIDATION MODE ===
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 70, 126);
    doc.text(`TRABAJOS DE ${data.specialist.name.toUpperCase()} - LÍDER DE EQUIPO`, 15, currentY);
    doc.setTextColor(0, 0, 0);
    currentY += 8;

    const leaderGroupedItems = groupItemsByClient(data.items);
    const leaderTableData = buildTableData(leaderGroupedItems);

    autoTable(doc, {
      startY: currentY,
      head: [['Servicio / Cliente', 'Proyecto/Presupuesto', 'Cantidad', 'Precio Unitario', 'Total']],
      body: leaderTableData,
      theme: 'striped',
      headStyles: {
        fillColor: [0, 70, 126],
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 8,
        cellPadding: 4,
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 40 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' },
      },
    });

    const leaderTotal = calculateItemsTotal(data.items);
    currentY = (doc as any).lastAutoTable.finalY + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Subtotal ${data.specialist.name}:`, pageWidth - 75, currentY);
    doc.text(formatCurrency(leaderTotal), pageWidth - 15, currentY, { align: 'right' });
    currentY += 15;

    for (const member of data.teamData!.members) {
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 70, 126);
      doc.text(`TRABAJOS DE ${member.specialist.name.toUpperCase()} - MIEMBRO DEL EQUIPO`, 15, currentY);
      doc.setTextColor(0, 0, 0);
      currentY += 8;

      const memberGroupedItems = groupItemsByClient(member.liquidation_items);
      const memberTableData = buildTableData(memberGroupedItems);

      autoTable(doc, {
        startY: currentY,
        head: [['Servicio / Cliente', 'Proyecto/Presupuesto', 'Cantidad', 'Precio Unitario', 'Total']],
        body: memberTableData,
        theme: 'striped',
        headStyles: {
          fillColor: [100, 100, 100],
          textColor: 255,
          fontSize: 9,
          fontStyle: 'bold',
        },
        styles: {
          fontSize: 8,
          cellPadding: 4,
        },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 40 },
          2: { cellWidth: 20, halign: 'center' },
          3: { cellWidth: 30, halign: 'right' },
          4: { cellWidth: 30, halign: 'right' },
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`Subtotal ${member.specialist.name}:`, pageWidth - 75, currentY);
      doc.text(formatCurrency(member.calculated_total), pageWidth - 15, currentY, { align: 'right' });
      currentY += 15;
    }

    doc.setLineWidth(0.5);
    doc.line(pageWidth - 100, currentY - 5, pageWidth - 15, currentY - 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL EQUIPO A PAGAR:', pageWidth - 100, currentY + 5);
    doc.text(formatCurrency(data.teamData!.teamTotal), pageWidth - 15, currentY + 5, { align: 'right' });

    currentY += 20;
  } else {
    // === SINGLE LIQUIDATION MODE ===
    const groupedItems = groupItemsByClient(data.items);
    const tableData = buildTableData(groupedItems);

    autoTable(doc, {
      startY: currentY,
      head: [['Servicio / Cliente', 'Proyecto/Presupuesto', 'Cantidad', 'Precio Unitario', 'Total']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [0, 70, 126],
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 9,
        cellPadding: 5,
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 40 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' },
      },
    });

    const calculatedTotal = calculateItemsTotal(data.items);
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const totalsX = pageWidth - 75;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL A PAGAR:', totalsX, finalY);
    doc.text(formatCurrency(calculatedTotal), pageWidth - 15, finalY, { align: 'right' });

    currentY = finalY;
  }

  // Notas
  if (data.liquidation.notes) {
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Notas:', 15, currentY + 15);
    const splitNotes = doc.splitTextToSize(data.liquidation.notes, pageWidth - 30);
    doc.text(splitNotes, 15, currentY + 22);
  }

  // Pending requests annex
  if (data.pendingRequests && data.pendingRequests.length > 0) {
    doc.addPage();
    let annexY = 20;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('ANEXO', pageWidth / 2, annexY, { align: 'center' });

    annexY += 12;

    doc.setFontSize(11);
    doc.text('TRABAJOS PENDIENTES PARA PRÓXIMA LIQUIDACIÓN', 15, annexY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('(Trabajos completados o en progreso aún no incluidos en esta liquidación)', 15, annexY + 6);

    const pendingTableData = data.pendingRequests.map(req => [
      req.code || '-',
      (req.title?.substring(0, 30) + (req.title && req.title.length > 30 ? '...' : '')) || '-',
      req.client?.name || '-',
      getProjectOrBudgetName(req),
      req.status === 'completed' ? 'Completado' : 'En progreso',
      formatCurrency(Number(req.cost_to_agency) || 0)
    ]);

    autoTable(doc, {
      startY: annexY + 12,
      head: [['Código', 'Título', 'Cliente', 'Proy./Pres.', 'Estado', 'Importe']],
      body: pendingTableData,
      theme: 'plain',
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [100, 100, 100],
        fontSize: 8,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 40 },
        2: { cellWidth: 30 },
        3: { cellWidth: 30 },
        4: { cellWidth: 22 },
        5: { cellWidth: 28, halign: 'right' },
      },
    });

    const totalPending = data.pendingRequests.reduce(
      (sum, req) => sum + (Number(req.cost_to_agency) || 0), 0
    );
    const pendingFinalY = (doc as any).lastAutoTable.finalY + 5;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Total pendiente: ${formatCurrency(totalPending)}`, pageWidth - 15, pendingFinalY, { align: 'right' });
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(
    'Esta liquidación representa los servicios prestados en el período indicado',
    pageWidth / 2,
    pageHeight - 20,
    { align: 'center' }
  );

  return doc.output('datauristring').split(',')[1];
};

interface GroupedClient {
  clientName: string;
  items: any[];
  subtotal: number;
}

const groupItemsByClient = (items: any[]): GroupedClient[] => {
  const grouped: { [clientName: string]: { items: any[]; subtotal: number } } = {};
  
  items.forEach((item) => {
    const clientName = item.financial_request_id 
      ? (item.financial_request?.client?.name || 'Sin cliente')
      : 'Otros conceptos';
    if (!grouped[clientName]) {
      grouped[clientName] = { items: [], subtotal: 0 };
    }
    grouped[clientName].items.push(item);
    const costToAgency = item.financial_request_id 
      ? (Number(item.financial_request?.cost_to_agency) || Number(item.unit_price) || 0)
      : Number(item.unit_price) || 0;
    grouped[clientName].subtotal += costToAgency;
  });
  
  return Object.entries(grouped).map(([clientName, data]) => ({
    clientName,
    items: data.items,
    subtotal: data.subtotal,
  }));
};

const buildTableData = (groupedItems: GroupedClient[]): any[][] => {
  const tableData: any[][] = [];
  
  groupedItems.forEach((group) => {
    // Client header row
    tableData.push([
      { content: group.clientName, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
      { content: formatCurrency(group.subtotal), styles: { fontStyle: 'bold', fillColor: [240, 240, 240], halign: 'right' } },
    ]);
    
    // Item rows
    group.items.forEach((item) => {
      const costToAgency = Number(item.financial_request?.cost_to_agency) || Number(item.unit_price) || 0;
      const requestTitle = item.financial_request?.title;
      const description = requestTitle 
        ? `  ${item.description}\n     ${requestTitle}` 
        : `  ${item.description}`;
      const displayQuantity = item.financial_request?.cost_type === 'hourly'
        ? (item.financial_request?.hours || item.quantity || 1)
        : (item.financial_request?.quantity || item.quantity || 1);
      const projectOrBudget = getProjectOrBudgetFromItem(item);
      tableData.push([
        description,
        projectOrBudget,
        displayQuantity.toString(),
        formatCurrency(costToAgency),
        formatCurrency(costToAgency),
      ]);
    });
  });

  return tableData;
};

const calculateItemsTotal = (items: any[]): number => {
  return items.reduce((sum, item) => {
    const costToAgency = item.financial_request_id 
      ? (Number(item.financial_request?.cost_to_agency) || Number(item.unit_price) || 0)
      : Number(item.unit_price) || 0;
    return sum + costToAgency;
  }, 0);
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

// Helper to get project or budget name from liquidation item
const getProjectOrBudgetFromItem = (item: any): string => {
  const opRequest = item.financial_request?.operational_request?.[0];
  if (opRequest?.operational_project?.name) {
    const name = opRequest.operational_project.name;
    return name.length > 25 ? name.substring(0, 23) + '...' : name;
  }
  if (item.financial_request?.budget) {
    const budget = item.financial_request.budget;
    const name = budget.title || budget.code;
    return name.length > 25 ? name.substring(0, 23) + '...' : name;
  }
  return '-';
};

// Helper to get project or budget name from pending request
const getProjectOrBudgetName = (req: PendingRequest): string => {
  const opRequest = req.operational_request?.[0];
  if (opRequest?.operational_project?.name) {
    const name = opRequest.operational_project.name;
    return name.length > 18 ? name.substring(0, 16) + '...' : name;
  }
  if (req.budget) {
    const name = req.budget.title || req.budget.code;
    return name.length > 18 ? name.substring(0, 16) + '...' : name;
  }
  return '-';
};
