// CSV export utility - replaces xlsx for security reasons

const escapeCSVField = (field: string | number | null | undefined): string => {
  if (field === null || field === undefined) return '';
  const str = String(field);
  // Escape fields containing semicolons, quotes, or newlines
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const downloadCSV = (data: any[][], fileName: string, _sheetName: string = 'Datos') => {
  // Use semicolon as delimiter for Spanish locale Excel compatibility
  const csvContent = data
    .map(row => row.map(escapeCSVField).join(';'))
    .join('\n');
  
  // Add BOM for proper UTF-8 encoding in Excel
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${fileName}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

// Keep the old name as an alias for backwards compatibility
export const downloadExcel = downloadCSV;

export const formatDate = (date: string | null): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-ES');
};

export const formatCurrency = (amount: number | null): string => {
  if (amount === null) return '-';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};
