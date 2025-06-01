
export const escapeCSVField = (field: any): string => {
  if (field === null || typeof field === 'undefined') {
    return '';
  }
  let str = String(field);
  // Replace " with ""
  str = str.replace(/"/g, '""');
  // If it contains comma, newline, or CR, or if it now contains quotes (because original had quotes), enclose in quotes
  if (str.search(/("|,|\n|\r)/g) >= 0) {
    str = `"${str}"`;
  }
  return str;
};

export const convertToCSV = (data: Record<string, any>[], headers: string[]): string => {
  const headerRow = headers.map(escapeCSVField).join(',');
  const dataRows = data.map(row => 
    headers.map(header => escapeCSVField(row[header] ?? '')).join(',')
  );
  return [headerRow, ...dataRows].join('\r\n');
};

export const downloadFile = (content: string | Blob, filename: string, stringContentType?: string) => {
  let blobToDownload: Blob;
  if (content instanceof Blob) {
    blobToDownload = content;
  } else {
    // If stringContentType is not provided for string content, default to text/plain
    blobToDownload = new Blob([content], { type: stringContentType || 'text/plain;charset=utf-8;' });
  }
  
  const url = URL.createObjectURL(blobToDownload);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};