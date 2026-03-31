import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getMonthName } from '@/lib/liquidation-utils';
import { groupItemsByClientAndProject } from '@/lib/liquidation-grouping';

interface CommissionDetail {
  type: string;
  percentage: number;
  baseAmount: number;
  invoiceCodes: string[];
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
  commissionDetails?: Record<string, CommissionDetail>;
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
    const leaderTableData = buildHierarchicalTableData(data.items, data.commissionDetails);

    autoTable(doc, {
      startY: currentY,
      head: [['Descripción', 'Cant.', 'Precio Unit.', 'Total', '']],
      body: leaderTableData,
      theme: 'plain',
      headStyles: {
        fillColor: [0, 70, 126],
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 28, halign: 'right' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 6 },
      },
    });

    // Leader subtotal
    const leaderTotal = calculateItemsTotal(data.items);
    currentY = (doc as any).lastAutoTable.finalY + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Subtotal ${data.specialist.name}:  ${formatCurrency(leaderTotal)}`, pageWidth - 15, currentY, { align: 'right' });
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

      const memberTableData = buildHierarchicalTableData(member.liquidation_items, data.commissionDetails);

      autoTable(doc, {
        startY: currentY,
        head: [['Descripción', 'Cant.', 'Precio Unit.', 'Total', '']],
        body: memberTableData,
        theme: 'plain',
        headStyles: {
          fillColor: [100, 100, 100],
          textColor: 255,
          fontSize: 9,
          fontStyle: 'bold',
        },
        styles: {
          fontSize: 8,
          cellPadding: 3,
        },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 18, halign: 'center' },
          2: { cellWidth: 28, halign: 'right' },
          3: { cellWidth: 28, halign: 'right' },
          4: { cellWidth: 6 },
        },
      });

      // Member subtotal
      currentY = (doc as any).lastAutoTable.finalY + 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`Subtotal ${member.specialist.name}:  ${formatCurrency(member.calculated_total)}`, pageWidth - 15, currentY, { align: 'right' });
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
    const tableData = buildHierarchicalTableData(data.items, data.commissionDetails);

    autoTable(doc, {
      startY: currentY,
      head: [['Descripción', 'Cant.', 'Precio Unit.', 'Total', '']],
      body: tableData,
      theme: 'plain',
      headStyles: {
        fillColor: [0, 70, 126],
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 28, halign: 'right' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 6 },
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

    const leaderTableData = buildHierarchicalTableData(data.items, data.commissionDetails);

    autoTable(doc, {
      startY: currentY,
      head: [['Descripción', 'Cant.', 'Precio Unit.', 'Total', '']],
      body: leaderTableData,
      theme: 'plain',
      headStyles: {
        fillColor: [0, 70, 126],
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 28, halign: 'right' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 6 },
      },
    });

    const leaderTotal = calculateItemsTotal(data.items);
    currentY = (doc as any).lastAutoTable.finalY + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Subtotal ${data.specialist.name}:  ${formatCurrency(leaderTotal)}`, pageWidth - 15, currentY, { align: 'right' });
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

      const memberTableData = buildHierarchicalTableData(member.liquidation_items, data.commissionDetails);

      autoTable(doc, {
        startY: currentY,
        head: [['Descripción', 'Cant.', 'Precio Unit.', 'Total', '']],
        body: memberTableData,
        theme: 'plain',
        headStyles: {
          fillColor: [100, 100, 100],
          textColor: 255,
          fontSize: 9,
          fontStyle: 'bold',
        },
        styles: {
          fontSize: 8,
          cellPadding: 3,
        },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 18, halign: 'center' },
          2: { cellWidth: 28, halign: 'right' },
          3: { cellWidth: 28, halign: 'right' },
          4: { cellWidth: 6 },
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`Subtotal ${member.specialist.name}:  ${formatCurrency(member.calculated_total)}`, pageWidth - 15, currentY, { align: 'right' });
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
    const tableData = buildHierarchicalTableData(data.items, data.commissionDetails);

    autoTable(doc, {
      startY: currentY,
      head: [['Descripción', 'Cant.', 'Precio Unit.', 'Total', '']],
      body: tableData,
      theme: 'plain',
      headStyles: {
        fillColor: [0, 70, 126],
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 28, halign: 'right' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 6 },
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

// Build table data with hierarchical grouping: Client → Project/Budget → Items
const buildHierarchicalTableData = (items: any[], commissionDetails?: Record<string, CommissionDetail>): any[][] => {
  const groupedItems = groupItemsByClientAndProject(items, commissionDetails);
  const tableData: any[][] = [];

  groupedItems.forEach((clientGroup) => {
    // Client header row
    tableData.push([
      { content: clientGroup.clientName, styles: { fontStyle: 'bold', fillColor: [230, 230, 230], textColor: [50, 50, 50] } },
      { content: '', styles: { fillColor: [230, 230, 230] } },
      { content: '', styles: { fillColor: [230, 230, 230] } },
      { content: formatCurrency(clientGroup.subtotal), styles: { fontStyle: 'bold', fillColor: [230, 230, 230], halign: 'right', textColor: [50, 50, 50] } },
      { content: '', styles: { fillColor: [230, 230, 230] } },
    ]);

    clientGroup.projectBudgets.forEach((projectGroup) => {
      let displayName = projectGroup.name;
      if (projectGroup.type === 'project') {
        displayName = `[Proy.] ${projectGroup.name}`;
      } else if (projectGroup.type === 'budget') {
        displayName = `[Presup.] ${projectGroup.name}`;
      }
      
      tableData.push([
        { content: `    ${displayName}`, styles: { fontStyle: projectGroup.type !== 'none' ? 'italic' : 'normal', fillColor: [245, 245, 245], textColor: [80, 80, 80], fontSize: 8 } },
        { content: '', styles: { fillColor: [245, 245, 245] } },
        { content: '', styles: { fillColor: [245, 245, 245] } },
        { content: formatCurrency(projectGroup.subtotal), styles: { fillColor: [245, 245, 245], halign: 'right', textColor: [100, 100, 100], fontSize: 8 } },
        { content: '', styles: { fillColor: [245, 245, 245] } },
      ]);

      projectGroup.items.forEach((item) => {
        const costToAgency = Number(item.financial_request?.cost_to_agency) || Number(item.unit_price) || 0;
        const requestCode = item.financial_request?.code || '-';
        const requestTitle = item.financial_request?.title;
        const description = requestTitle 
          ? `      ${requestCode} - ${requestTitle.substring(0, 30)}${requestTitle.length > 30 ? '...' : ''}` 
          : `      ${item.description}`;
        const displayQuantity = item.financial_request?.cost_type === 'hourly'
          ? (item.financial_request?.hours || item.quantity || 1)
          : (item.financial_request?.quantity || item.quantity || 1);
        
        tableData.push([
          description,
          displayQuantity.toString(),
          formatCurrency(costToAgency),
          formatCurrency(costToAgency),
          '',
        ]);

        // Add commission detail sub-line if applicable
        if (!item.financial_request && item.description?.startsWith('Comisión') && commissionDetails) {
          const detail = Object.values(commissionDetails).find(d => {
            const typeLabel = d.type === 'am' ? 'AM' : d.type === 'pm' ? 'PM' : 'Venta';
            return item.description?.includes(`Comisión ${typeLabel}`);
          });
          if (detail) {
            const invoiceLabel = detail.invoiceCodes.length === 1
              ? `Factura Nº ${detail.invoiceCodes[0]}`
              : detail.invoiceCodes.length > 1
                ? `Facturas ${detail.invoiceCodes.join(', ')}`
                : '';
            const subLine = `        ${detail.percentage}% sobre ${formatCurrency(detail.baseAmount)}${invoiceLabel ? ` — ${invoiceLabel}` : ''}`;
            tableData.push([
              { content: subLine, styles: { fontSize: 7, textColor: [120, 120, 120] } },
              { content: '', styles: { fontSize: 7 } },
              { content: '', styles: { fontSize: 7 } },
              { content: '', styles: { fontSize: 7 } },
              { content: '', styles: { fontSize: 7 } },
            ]);
          }
        }
      });
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

