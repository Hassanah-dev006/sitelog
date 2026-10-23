/**
 * Downloading a file that needs authentication.
 *
 * A plain <a href> is a browser navigation: no JavaScript runs, so the
 * Authorization header never gets attached and the API answers 401. The file
 * has to be fetched like any other request, then handed to the browser as a
 * blob.
 */

/** Pulls the filename out of a Content-Disposition header. */
export function filenameFromDisposition(header, fallback = 'download') {
  if (!header) return fallback;

  // RFC 5987 form first: filename*=UTF-8''name.pdf
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      /* fall through to the plain form */
    }
  }

  const plain = header.match(/filename="?([^";]+)"?/i);
  if (plain) return plain[1].trim();

  return fallback;
}

/**
 * Hands a blob to the browser as a download.
 *
 * The object URL is revoked afterwards; without that the blob stays in
 * memory for the life of the page, which matters when someone exports a
 * dozen reports in a sitting.
 */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Safari needs the URL to outlive the click by a moment.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
