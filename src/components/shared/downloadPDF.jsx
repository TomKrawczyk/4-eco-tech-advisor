/**
 * Otwiera / pobiera PDF z base64 data URI.
 * Na mobile tworzy blob i otwiera object URL (działa na Android/iOS).
 * Na desktop używa linku z download.
 */
export function openOrDownloadPDF(pdf_base64, filename = 'raport.pdf') {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    // Wyodrębnij dane base64 z data URI
    const base64Data = pdf_base64.split(',')[1];
    const byteChars = atob(base64Data);
    const byteNumbers = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([byteNumbers], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } else {
    const a = document.createElement('a');
    a.href = pdf_base64;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}