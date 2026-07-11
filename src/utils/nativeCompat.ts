/**
 * Trelvix AI Native Compatibility Layer
 * Permanent Bridge & Utility Layer for Android (Kodular WebViewer) and Web Browsers.
 */

/**
 * Detects if the current environment is running inside a WebView or APK runtime.
 */
export const isWebViewEnv = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    /wv|WebView|InAppBrowser|Android.*Version\/[0-9.]+/i.test(navigator.userAgent) ||
    (window as any).Android !== undefined ||
    (window as any).AppInventor !== undefined ||
    window.location.search.includes('apk=true') ||
    window.location.search.includes('webview=true')
  );
};

/**
 * Specifically detects if running inside a Kodular/App Inventor WebViewer.
 */
export const isKodularEnv = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (window as any).AppInventor !== undefined;
};

/**
 * Helper to convert any Blob, Data URI, or Remote URL to a Base64 data string.
 */
export async function toBase64(source: string | Blob): Promise<string> {
  if (source instanceof Blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(source);
    });
  }

  if (source.startsWith('data:')) {
    return source;
  }

  // It's a remote URL. Let's try fetching it and converting to a base64 string
  try {
    const response = await fetch(source);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('[NativeBridge] Failed to fetch remote URL for base64 conversion (likely CORS restriction on direct browser fetches). Passing empty base64.', error);
    return '';
  }
}

/**
 * Unified file downloader that automatically routes logic depending on the environment.
 * 
 * - In Web Browsers: Uses standard modern temporary anchor tag trigger.
 * - In Kodular: Packages metadata, base64 file data, and remote URL, and passes them to the Android host.
 */
export async function downloadFile(
  source: string | Blob,
  filename: string,
  mimeType: string
): Promise<void> {
  if (isKodularEnv()) {
    console.log(`[NativeBridge] Routing download for ${filename} (${mimeType}) through Kodular WebViewer bridge.`);
    try {
      // Resolve base64 representation of the source
      const base64Data = await toBase64(source);
      
      // Determine direct URL if it's a web link
      const directUrl = (typeof source === 'string' && !source.startsWith('data:')) ? source : '';

      // Set WebViewString with clean action-payload schema
      (window as any).AppInventor.setWebViewString(
        JSON.stringify({
          action: 'download_file',
          payload: {
            url: directUrl,
            base64: base64Data,
            filename: filename,
            mimeType: mimeType
          }
        })
      );
      return;
    } catch (e) {
      console.error('[NativeBridge] Kodular WebViewer string bridge error:', e);
    }
  }

  // Standard Web Browser Fallback (completely preserves existing high-quality web browser experience)
  console.log(`[NativeBridge] Routing download for ${filename} to standard web anchor.`);
  let url = '';
  let isTempBlob = false;

  if (source instanceof Blob) {
    url = URL.createObjectURL(source);
    isTempBlob = true;
  } else {
    url = source;
  }

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  
  // Cleanup
  document.body.removeChild(a);
  if (isTempBlob) {
    URL.revokeObjectURL(url);
  }
}

/**
 * Robustly opens an external link.
 * 
 * - In Web Browsers: Opens in a new tab.
 * - In Kodular: Passes command to the Android host to open in standard system browser (Chrome/Safari),
 *   completely bypassing sandboxed WebViewer user-agent or login restrictions.
 */
export function openExternalLink(url: string): void {
  if (isKodularEnv()) {
    console.log(`[NativeBridge] Routing external link ${url} through Kodular bridge.`);
    try {
      (window as any).AppInventor.setWebViewString(
        JSON.stringify({
          action: 'open_external_browser',
          payload: {
            url: url
          }
        })
      );
      return;
    } catch (e) {
      console.error('[NativeBridge] Kodular WebViewer string bridge error:', e);
    }
  }

  // Default browser behavior
  window.open(url, '_blank');
}
