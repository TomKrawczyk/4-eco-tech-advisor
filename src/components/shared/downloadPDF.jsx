
/**
 * Otwiera / pobiera PDF z base64 data URI.
 * Konwertuje do Blob i używa <a download> — działa na Android, iOS, desktop.
 */
export function openOrDownloadPDF(pdf_base64, filename = 'raport.pdf') {
  // Wyodrębnij dane base64 z data URI (format: data:application/pdf;base64,XXXX)
  const base64Data = pdf_base64.includes(',') ? pdf_base64.split(',')[1] : pdf_base64;
  const byteChars = atob(base64Data);
  const byteNumbers = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([byteNumbers], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isIOS) {
    // iOS Safari blokuje window.open poza sync eventem — otwieramy w tym samym oknie
    window.location.href = url;
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
