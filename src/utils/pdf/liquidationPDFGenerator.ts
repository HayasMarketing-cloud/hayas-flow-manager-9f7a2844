import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PendingRequest {
  id: string;
  code: string;
  title: string;
  status: string;
  cost_to_agency: number | null;
  client?: { id: string; name: string } | null;
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

  // Agrupar items por cliente
  const groupedItems = groupItemsByClient(data.items);

  // Preparar datos de la tabla con agrupación por cliente
  const tableData: any[][] = [];
  
  groupedItems.forEach((group) => {
    // Fila de encabezado del cliente
    tableData.push([
      { content: group.clientName, colSpan: 3, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
      { content: formatCurrency(group.subtotal), styles: { fontStyle: 'bold', fillColor: [240, 240, 240], halign: 'right' } },
    ]);
    
    // Filas de items del cliente
    group.items.forEach((item) => {
      const costToAgency = Number(item.financial_request?.cost_to_agency) || Number(item.unit_price) || 0;
      const requestTitle = item.financial_request?.title;
      const description = requestTitle 
        ? `  ${item.description}\n     ${requestTitle}` 
        : `  ${item.description}`;
      tableData.push([
        description,
        item.quantity.toString(),
        formatCurrency(costToAgency),
        formatCurrency(costToAgency),
      ]);
    });
  });

  autoTable(doc, {
    startY: 58,
    head: [['Servicio / Cliente', 'Cantidad', 'Precio Unitario', 'Total']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [0, 70, 126], // Corporate blue #00467E
      textColor: 255,
      fontSize: 10,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 9,
      cellPadding: 5,
    },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
    },
  });

  // Calcular total desde los items en lugar de usar subtotal guardado
  const calculatedTotal = data.items.reduce((sum, item) => {
    const costToAgency = item.financial_request_id 
      ? (Number(item.financial_request?.cost_to_agency) || Number(item.unit_price) || 0)
      : Number(item.unit_price) || 0;
    return sum + costToAgency;
  }, 0);

  // Total
  const finalY = (doc as any).lastAutoTable.finalY + 10;

  const totalsX = pageWidth - 75;
  
  // Total en negrita
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL A PAGAR:', totalsX, finalY);
  doc.text(formatCurrency(calculatedTotal), pageWidth - 15, finalY, { align: 'right' });

  // Notas
  let currentY = finalY;
  if (data.liquidation.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Notas:', 15, currentY + 30);
    const splitNotes = doc.splitTextToSize(data.liquidation.notes, pageWidth - 30);
    doc.text(splitNotes, 15, currentY + 37);
    currentY = currentY + 37 + (splitNotes.length * 5);
  } else {
    currentY = finalY + 15;
  }

  // Sección de solicitudes pendientes - Siempre en nueva página como ANEXO
  if (data.pendingRequests && data.pendingRequests.length > 0) {
    // Siempre añadir nueva página para el anexo
    doc.addPage();
    let annexY = 20;

    // Título del anexo
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('ANEXO', pageWidth / 2, annexY, { align: 'center' });

    annexY += 12;

    // Subtítulo de la sección
    doc.setFontSize(11);
    doc.text('TRABAJOS PENDIENTES PARA PRÓXIMA LIQUIDACIÓN', 15, annexY);

    // Subtítulo informativo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('(Trabajos completados o en progreso aún no incluidos en esta liquidación)', 15, annexY + 6);

    // Tabla de solicitudes pendientes
    const pendingTableData = data.pendingRequests.map(req => [
      req.code || '-',
      (req.title?.substring(0, 35) + (req.title && req.title.length > 35 ? '...' : '')) || '-',
      req.client?.name || '-',
      req.status === 'completed' ? 'Completado' : 'En progreso',
      formatCurrency(Number(req.cost_to_agency) || 0)
    ]);

    autoTable(doc, {
      startY: annexY + 12,
      head: [['Código', 'Título', 'Cliente', 'Estado', 'Importe']],
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
        0: { cellWidth: 25 },
        1: { cellWidth: 55 },
        2: { cellWidth: 40 },
        3: { cellWidth: 25 },
        4: { cellWidth: 30, halign: 'right' },
      },
    });

    // Total pendiente
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
  doc.save(`liquidacion_${data.liquidation.code}.pdf`);
};

// Generate PDF as Base64 string for email attachment
export const generateLiquidationPDFBase64 = async (data: LiquidationData): Promise<string> => {
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

  // Agrupar items por cliente
  const groupedItems = groupItemsByClient(data.items);

  // Preparar datos de la tabla con agrupación por cliente
  const tableData: any[][] = [];
  
  groupedItems.forEach((group) => {
    // Fila de encabezado del cliente
    tableData.push([
      { content: group.clientName, colSpan: 3, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
      { content: formatCurrency(group.subtotal), styles: { fontStyle: 'bold', fillColor: [240, 240, 240], halign: 'right' } },
    ]);
    
    // Filas de items del cliente
    group.items.forEach((item) => {
      const costToAgency = Number(item.financial_request?.cost_to_agency) || Number(item.unit_price) || 0;
      const requestTitle = item.financial_request?.title;
      const description = requestTitle 
        ? `  ${item.description}\n     ${requestTitle}` 
        : `  ${item.description}`;
      tableData.push([
        description,
        item.quantity.toString(),
        formatCurrency(costToAgency),
        formatCurrency(costToAgency),
      ]);
    });
  });

  autoTable(doc, {
    startY: 58,
    head: [['Servicio / Cliente', 'Cantidad', 'Precio Unitario', 'Total']],
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
      0: { cellWidth: 90 },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
    },
  });

  // Calcular total desde los items en lugar de usar subtotal guardado
  const calculatedTotal = data.items.reduce((sum, item) => {
    const costToAgency = item.financial_request_id 
      ? (Number(item.financial_request?.cost_to_agency) || Number(item.unit_price) || 0)
      : Number(item.unit_price) || 0;
    return sum + costToAgency;
  }, 0);

  // Total
  const finalY = (doc as any).lastAutoTable.finalY + 10;

  const totalsX = pageWidth - 75;
  
  // Total en negrita
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL A PAGAR:', totalsX, finalY);
  doc.text(formatCurrency(calculatedTotal), pageWidth - 15, finalY, { align: 'right' });

  // Notas
  let currentY = finalY;
  if (data.liquidation.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Notas:', 15, currentY + 30);
    const splitNotes = doc.splitTextToSize(data.liquidation.notes, pageWidth - 30);
    doc.text(splitNotes, 15, currentY + 37);
    currentY = currentY + 37 + (splitNotes.length * 5);
  } else {
    currentY = finalY + 15;
  }

  // Sección de solicitudes pendientes - Siempre en nueva página como ANEXO
  if (data.pendingRequests && data.pendingRequests.length > 0) {
    // Siempre añadir nueva página para el anexo
    doc.addPage();
    let annexY = 20;

    // Título del anexo
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('ANEXO', pageWidth / 2, annexY, { align: 'center' });

    annexY += 12;

    // Subtítulo de la sección
    doc.setFontSize(11);
    doc.text('TRABAJOS PENDIENTES PARA PRÓXIMA LIQUIDACIÓN', 15, annexY);

    // Subtítulo informativo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('(Trabajos completados o en progreso aún no incluidos en esta liquidación)', 15, annexY + 6);

    // Tabla de solicitudes pendientes
    const pendingTableData = data.pendingRequests.map(req => [
      req.code || '-',
      (req.title?.substring(0, 35) + (req.title && req.title.length > 35 ? '...' : '')) || '-',
      req.client?.name || '-',
      req.status === 'completed' ? 'Completado' : 'En progreso',
      formatCurrency(Number(req.cost_to_agency) || 0)
    ]);

    autoTable(doc, {
      startY: annexY + 12,
      head: [['Código', 'Título', 'Cliente', 'Estado', 'Importe']],
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
        0: { cellWidth: 25 },
        1: { cellWidth: 55 },
        2: { cellWidth: 40 },
        3: { cellWidth: 25 },
        4: { cellWidth: 30, halign: 'right' },
      },
    });

    // Total pendiente
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

  // Return as base64 string (without the data:application/pdf;base64, prefix)
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
    // Items sin financial_request son manuales
    const clientName = item.financial_request_id 
      ? (item.financial_request?.client?.name || 'Sin cliente')
      : 'Otros conceptos';
    if (!grouped[clientName]) {
      grouped[clientName] = { items: [], subtotal: 0 };
    }
    grouped[clientName].items.push(item);
    // Usar cost_to_agency del financial_request para el subtotal, o unit_price para items manuales
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

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};