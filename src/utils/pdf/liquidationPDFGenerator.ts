import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LiquidationData {
  liquidation: any;
  items: any[];
  specialist: any;
  companyInfo?: {
    name: string;
    address: string;
    taxId: string;
    phone: string;
    email: string;
  };
}

export const generateLiquidationPDF = async (data: LiquidationData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Información de la empresa
  const company = data.companyInfo || {
    name: 'Mi Empresa S.L.',
    address: 'Calle Principal, 123 - 28001 Madrid',
    taxId: 'B-12345678',
    phone: '+34 912 345 678',
    email: 'info@miempresa.com',
  };

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(company.name, 15, 20);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(company.address, 15, 27);
  doc.text(`CIF: ${company.taxId}`, 15, 32);
  doc.text(`Tel: ${company.phone}`, 15, 37);
  doc.text(`Email: ${company.email}`, 15, 42);

  // Título
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('LIQUIDACIÓN', pageWidth - 15, 20, { align: 'right' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(data.liquidation.code, pageWidth - 15, 27, { align: 'right' });

  const monthName = new Date(data.liquidation.period_year, data.liquidation.period_month - 1)
    .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  doc.text(`Período: ${monthName}`, pageWidth - 15, 34, { align: 'right' });

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

  // Tabla de servicios/items
  const tableData = data.items.map((item) => [
    item.description,
    item.quantity.toString(),
    formatCurrency(item.unit_price),
    formatCurrency(item.total),
  ]);

  autoTable(doc, {
    startY: 95,
    head: [['Servicio', 'Cantidad', 'Precio Unitario', 'Total']],
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

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};
