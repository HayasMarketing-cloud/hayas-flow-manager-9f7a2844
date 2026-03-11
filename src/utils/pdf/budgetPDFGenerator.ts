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
    client_po_number?: string | null;
    requested_by?: string | null;
    quote_code?: string | null;
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
    doc.addImage(logoImg, 'PNG', 15, 12, 35, 35);
  } catch (e) {
    console.warn('Could not load logo for PDF');
  }

  // Header - Datos de empresa (al lado del logo)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(company.name, 53, 18);
  doc.text(company.tradeName || '', 53, 24);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(company.address, 53, 31);
  doc.text(`Tel: ${company.phone}`, 53, 37);
  doc.text(company.email, 53, 43);

  // Título - Derecha (QUOTE + Cliente + Título + Código + PO)
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('QUOTE', pageWidth - 15, 18, { align: 'right' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(data.budget.client.name, pageWidth - 15, 26, { align: 'right' });

  doc.setFontSize(10);
  const displayCode = data.budget.quote_code || data.budget.code;
  doc.text(`REF: ${displayCode}`, pageWidth - 15, 33, { align: 'right' });

  // PO Number / Client Reference
  const poNumber = data.budget.client_po_number || 'Pendiente';
  doc.setFontSize(9);
  doc.text(`PO: ${poNumber}`, pageWidth - 15, 39, { align: 'right' });

  // Línea divisoria
  doc.setLineWidth(0.5);
  doc.line(15, 52, pageWidth - 15, 52);

  // Client information
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENT', 15, 62);

  doc.setFont('helvetica', 'normal');
  doc.text(data.budget.client.name, 15, 69);
  
  let clientInfoY = 69;
  
  // Requested by
  if (data.budget.requested_by) {
    clientInfoY += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('Requested by: ', 15, clientInfoY);
    const requestedByX = 15 + doc.getTextWidth('Requested by: ');
    doc.setFont('helvetica', 'normal');
    doc.text(data.budget.requested_by, requestedByX, clientInfoY);
  }

  // Quote validity (right side)
  let validUntilY = 62;
  if (data.budget.valid_until) {
    doc.setFont('helvetica', 'bold');
    doc.text('Valid until:', pageWidth - 60, 62);
    doc.setFont('helvetica', 'normal');
    const validUntilDate = new Date(data.budget.valid_until);
    const formattedDate = validUntilDate.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    doc.text(formattedDate, pageWidth - 60, 69);
    validUntilY = 69;
  }

  // Full quote title (below client and validity)
  const titleStartY = Math.max(clientInfoY + 12, validUntilY + 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('DESCRIPTION', 15, titleStartY);
  
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
        item.description,
        item.quantity.toString(),
        formatCurrency(item.unit_price),
        formatCurrency(item.total),
      ]);
    });
  });

  const tableStartY = Math.max(titleEndY + 10, 110);

  autoTable(doc, {
    startY: tableStartY,
    head: [['Description', 'Quantity', 'Unit Price', 'Total']],
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

  // Description/Objective
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomMargin = 30; // space for footer
  const lineHeight = 5;

  if (data.budget.description) {
    let currentY = finalY + 20;

    // Check if we need a new page for the objective header
    if (currentY > pageHeight - bottomMargin) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Objective:', 15, currentY);
    currentY += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const splitDescription = doc.splitTextToSize(data.budget.description, pageWidth - 30);

    for (let i = 0; i < splitDescription.length; i++) {
      if (currentY > pageHeight - bottomMargin) {
        doc.addPage();
        currentY = 20;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
      }
      doc.text(splitDescription[i], 15, currentY);
      currentY += lineHeight;
    }
  }

  // Footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      'This quote is valid until the date indicated',
      pageWidth / 2,
      pageHeight - 15,
      { align: 'center' }
    );
  }

  // Download
  const fileCode = data.budget.quote_code || data.budget.code;
  doc.save(`quote_${fileCode}.pdf`);
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
    const categoryName = item.service?.category || item.service?.name || 'Other services';
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
    useGrouping: true,
    minimumFractionDigits: 2,
  }).format(amount);
};
