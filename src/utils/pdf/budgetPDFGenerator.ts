import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface BudgetPDFData {
  budget: {
    code: string;
    title: string;
    description?: string | null;
    valid_until?: string | null;
    created_at: string;
    total_amount?: number | null;
    client: {
      id: string;
      name: string;
      code?: string | null;
      address?: string | null;
      city?: string | null;
      tax_id?: string | null;
    };
  };
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
    service?: {
      id: string;
      name: string;
      category?: string | null;
    } | null;
  }>;
  companyInfo?: {
    name: string;
    tradeName?: string;
    address: string;
    phone: string;
    email: string;
  };
}

export const generateBudgetPDF = async (data: BudgetPDFData) => {
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

  // Título - Derecha (PRESUPUESTO + Cliente + Título + Código)
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('PRESUPUESTO', pageWidth - 15, 18, { align: 'right' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(data.budget.client.name, pageWidth - 15, 26, { align: 'right' });

  // Título del presupuesto (truncado si es muy largo)
  const budgetTitle = data.budget.title.length > 35 
    ? data.budget.title.substring(0, 35) + '...' 
    : data.budget.title;
  doc.text(budgetTitle, pageWidth - 15, 33, { align: 'right' });

  doc.setFontSize(10);
  doc.text(data.budget.code, pageWidth - 15, 40, { align: 'right' });

  // Línea divisoria
  doc.setLineWidth(0.5);
  doc.line(15, 50, pageWidth - 15, 50);

  // Información del cliente
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', 15, 60);

  doc.setFont('helvetica', 'normal');
  doc.text(data.budget.client.name, 15, 67);
  
  let clientInfoY = 67;
  if (data.budget.client.tax_id) {
    clientInfoY += 7;
    doc.text(`CIF/NIF: ${data.budget.client.tax_id}`, 15, clientInfoY);
  }
  if (data.budget.client.address) {
    clientInfoY += 7;
    doc.text(data.budget.client.address, 15, clientInfoY);
  }
  if (data.budget.client.city) {
    clientInfoY += 7;
    doc.text(data.budget.client.city, 15, clientInfoY);
  }

  // Validez del presupuesto (derecha)
  let validUntilY = 60;
  if (data.budget.valid_until) {
    doc.setFont('helvetica', 'bold');
    doc.text('Válido hasta:', pageWidth - 60, 60);
    doc.setFont('helvetica', 'normal');
    const validUntilDate = new Date(data.budget.valid_until);
    const formattedDate = validUntilDate.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    doc.text(formattedDate, pageWidth - 60, 67);
    validUntilY = 67;
  }

  // Título completo del presupuesto (debajo de cliente y validez)
  const titleStartY = Math.max(clientInfoY + 12, validUntilY + 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('CONCEPTO', 15, titleStartY);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const splitTitle = doc.splitTextToSize(data.budget.title, pageWidth - 30);
  doc.text(splitTitle, 15, titleStartY + 7);
  
  const titleEndY = titleStartY + 7 + (splitTitle.length - 1) * 5;

  // Agrupar items por categoría de servicio
  const groupedItems = groupItemsByCategory(data.items);

  // Preparar datos de la tabla con agrupación por categoría
  const tableData: any[][] = [];
  
  groupedItems.forEach((group) => {
    // Fila de encabezado de la categoría
    tableData.push([
      { content: group.categoryName, colSpan: 3, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
      { content: formatCurrency(group.subtotal), styles: { fontStyle: 'bold', fillColor: [240, 240, 240], halign: 'right' } },
    ]);
    
    // Filas de items de la categoría
    group.items.forEach((item) => {
      tableData.push([
        `  ${item.description}`,
        item.quantity.toString(),
        formatCurrency(item.unit_price),
        formatCurrency(item.total),
      ]);
    });
  });

  const tableStartY = Math.max(titleEndY + 10, 110);

  autoTable(doc, {
    startY: tableStartY,
    head: [['Descripción', 'Cantidad', 'Precio Unitario', 'Total']],
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

  // Total
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const totalsX = pageWidth - 75;
  
  // Total en negrita
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL:', totalsX, finalY);
  
  const total = data.budget.total_amount || data.items.reduce((sum, item) => sum + item.total, 0);
  doc.text(formatCurrency(total), pageWidth - 15, finalY, { align: 'right' });

  // Descripción/Objetivo
  if (data.budget.description) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Objetivo:', 15, finalY + 20);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const splitDescription = doc.splitTextToSize(data.budget.description, pageWidth - 30);
    doc.text(splitDescription, 15, finalY + 27);
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(
    'Este presupuesto tiene validez hasta la fecha indicada',
    pageWidth / 2,
    pageHeight - 20,
    { align: 'center' }
  );

  // Descargar
  doc.save(`presupuesto_${data.budget.code}.pdf`);
};

interface GroupedCategory {
  categoryName: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  subtotal: number;
}

const groupItemsByCategory = (items: BudgetPDFData['items']): GroupedCategory[] => {
  const grouped: { [categoryName: string]: { items: typeof items; subtotal: number } } = {};
  
  items.forEach((item) => {
    const categoryName = item.service?.category || item.service?.name || 'Otros servicios';
    if (!grouped[categoryName]) {
      grouped[categoryName] = { items: [], subtotal: 0 };
    }
    grouped[categoryName].items.push(item);
    grouped[categoryName].subtotal += item.total;
  });
  
  return Object.entries(grouped).map(([categoryName, data]) => ({
    categoryName,
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
