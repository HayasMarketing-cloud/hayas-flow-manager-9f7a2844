import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LiquidationData {
  liquidation: any;
  items: any[];
  specialist: any;
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

  // Información del especialista
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ESPECIALISTA', 15, 60);

  doc.setFont('helvetica', 'normal');
  doc.text(data.specialist.name, 15, 67);
  if (data.specialist.email) {
    doc.text(`Email: ${data.specialist.email}`, 15, 74);
  }
  if (data.specialist.phone) {
    doc.text(`Tel: ${data.specialist.phone}`, 15, 81);
  }

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
    startY: 95,
    head: [['Servicio / Cliente', 'Cantidad', 'Precio Unitario', 'Total']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [66, 70, 229],
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
  doc.text('TOTAL A PAGAR:', totalsX, finalY);
  doc.text(formatCurrency(data.liquidation.subtotal), pageWidth - 15, finalY, { align: 'right' });

  // Notas
  if (data.liquidation.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Notas:', 15, finalY + 30);
    const splitNotes = doc.splitTextToSize(data.liquidation.notes, pageWidth - 30);
    doc.text(splitNotes, 15, finalY + 37);
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

interface GroupedClient {
  clientName: string;
  items: any[];
  subtotal: number;
}

const groupItemsByClient = (items: any[]): GroupedClient[] => {
  const grouped: { [clientName: string]: { items: any[]; subtotal: number } } = {};
  
  items.forEach((item) => {
    const clientName = item.financial_request?.client?.name || 'Sin cliente';
    if (!grouped[clientName]) {
      grouped[clientName] = { items: [], subtotal: 0 };
    }
    grouped[clientName].items.push(item);
    // Usar cost_to_agency del financial_request para el subtotal
    const costToAgency = Number(item.financial_request?.cost_to_agency) || Number(item.unit_price) || 0;
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