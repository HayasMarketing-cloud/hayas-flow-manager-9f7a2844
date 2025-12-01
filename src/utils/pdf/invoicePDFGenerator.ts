import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface InvoiceData {
  invoice: any;
  items: any[];
  client: any;
  companyInfo?: {
    name: string;
    address: string;
    taxId: string;
    phone: string;
    email: string;
  };
}

export const generateInvoicePDF = async (data: InvoiceData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Información de la empresa (por defecto)
  const company = data.companyInfo || {
    name: 'Mi Empresa S.L.',
    address: 'Calle Principal, 123 - 28001 Madrid',
    taxId: 'B-12345678',
    phone: '+34 912 345 678',
    email: 'info@miempresa.com',
  };

  // Header con logo (placeholder)
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(company.name, 15, 20);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(company.address, 15, 27);
  doc.text(`CIF: ${company.taxId}`, 15, 32);
  doc.text(`Tel: ${company.phone}`, 15, 37);
  doc.text(`Email: ${company.email}`, 15, 42);

  // Título de factura
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURA', pageWidth - 15, 20, { align: 'right' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(data.invoice.code, pageWidth - 15, 27, { align: 'right' });
  doc.text(`Fecha: ${formatDate(data.invoice.invoice_date)}`, pageWidth - 15, 34, { align: 'right' });
  if (data.invoice.due_date) {
    doc.text(`Vencimiento: ${formatDate(data.invoice.due_date)}`, pageWidth - 15, 41, { align: 'right' });
  }

  // Línea divisoria
  doc.setLineWidth(0.5);
  doc.line(15, 50, pageWidth - 15, 50);

  // Información del cliente
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', 15, 60);

  doc.setFont('helvetica', 'normal');
  doc.text(data.client.name, 15, 67);
  if (data.client.tax_id) {
    doc.text(`CIF: ${data.client.tax_id}`, 15, 74);
  }
  if (data.client.address) {
    doc.text(data.client.address, 15, 81);
  }
  if (data.client.city) {
    doc.text(`${data.client.city}${data.client.country ? ', ' + data.client.country : ''}`, 15, 88);
  }

  // Tabla de items con columna de IVA
  const tableData = data.items.map((item) => [
    item.description,
    item.quantity.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
    formatCurrency(item.unit_price),
    formatCurrency(item.total),
    `${data.invoice.tax_rate}%`,
  ]);

  autoTable(doc, {
    startY: 100,
    head: [['Descripción', 'Cantidad', 'Precio Unitario', 'Total', 'IVA']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [66, 70, 229], // primary color
      textColor: 255,
      fontSize: 10,
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 9,
      cellPadding: 5,
    },
    columnStyles: {
      0: { cellWidth: 75 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 20, halign: 'center' },
    },
  });

  // Totales
  const finalY = (doc as any).lastAutoTable.finalY + 10;

  const totalsX = pageWidth - 75;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  doc.text('Subtotal:', totalsX, finalY);
  doc.text(formatCurrency(data.invoice.subtotal), pageWidth - 15, finalY, { align: 'right' });

  doc.text(`IVA (${data.invoice.tax_rate}%):`, totalsX, finalY + 7);
  doc.text(formatCurrency(data.invoice.tax_amount), pageWidth - 15, finalY + 7, { align: 'right' });

  // Total en negrita
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL:', totalsX, finalY + 17);
  doc.text(formatCurrency(data.invoice.total_amount), pageWidth - 15, finalY + 17, { align: 'right' });

  // Notas
  if (data.invoice.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Notas:', 15, finalY + 30);
    const splitNotes = doc.splitTextToSize(data.invoice.notes, pageWidth - 30);
    doc.text(splitNotes, 15, finalY + 37);
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text('Gracias por su confianza', pageWidth / 2, pageHeight - 20, { align: 'center' });

  // Descargar
  doc.save(`factura_${data.invoice.code}.pdf`);
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};
