export function downloadBlob(blob: Blob, filename: string) {
  if (!blob.size) throw new Error('The generated document was empty.');

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Let the browser begin consuming the blob before releasing its object URL.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
