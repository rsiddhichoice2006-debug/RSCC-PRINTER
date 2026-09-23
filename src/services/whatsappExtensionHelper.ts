import JSZip from 'jszip';

export const EXTENSION_MANIFEST = `{
  "manifest_version": 3,
  "name": "RSCC WhatsApp Single-Tab Companion",
  "version": "1.0.0",
  "description": "Directs customer pickup notifications into your already-open WhatsApp Web tab in Chrome without opening new tabs.",
  "permissions": ["tabs"],
  "host_permissions": [
    "*://web.whatsapp.com/*",
    "*://*/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["*://*/*"],
      "js": ["content.js"],
      "run_at": "document_start"
    }
  ]
}`;

export const EXTENSION_BACKGROUND = `chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'RSCC_NAVIGATE_WHATSAPP') {
    const { phone, message } = request;
    const cleanPhone = (phone || '').replace(/\\D/g, '').slice(-10);
    const targetUrl = "https://web.whatsapp.com/send?phone=91" + cleanPhone + "&text=" + encodeURIComponent(message || '');

    // Search for any tab in Chrome where WhatsApp Web is already open
    chrome.tabs.query({ url: "*://web.whatsapp.com/*" }, (tabs) => {
      if (tabs && tabs.length > 0) {
        // Reuse the exact already-open tab! Never open a new tab!
        const existingTab = tabs[0];
        chrome.tabs.update(existingTab.id, { url: targetUrl, active: true }, () => {
          if (existingTab.windowId) {
            chrome.windows.update(existingTab.windowId, { focused: true });
          }
        });
      } else {
        // If WhatsApp Web is not opened yet in Chrome, open it
        chrome.tabs.create({ url: targetUrl });
      }
    });

    sendResponse({ success: true, reusedTab: true });
    return true;
  }
});`;

export const EXTENSION_CONTENT = `// Listen for message dispatch from RSCC Admin Dashboard
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'RSCC_DISPATCH_WHATSAPP') {
    chrome.runtime.sendMessage({
      action: 'RSCC_NAVIGATE_WHATSAPP',
      phone: event.data.phone,
      message: event.data.message
    }, () => {
      if (chrome.runtime.lastError) {
        // Ignored
      }
    });
  }
});

// Announce to web app that the extension is active
function pingActive() {
  window.postMessage({ type: 'RSCC_EXTENSION_ACTIVE', version: '1.0.0' }, '*');
}

pingActive();
setInterval(pingActive, 2500);`;

export const EXTENSION_README = `RSCC WhatsApp Single-Tab Companion (Chrome Extension)
======================================================
This extension solves the problem of Chrome opening multiple tabs for WhatsApp.
When you click "Mark Ready" in RSCC Admin, it finds your ALREADY OPEN WhatsApp Web
tab in Chrome, opens the customer's chat in THAT SAME TAB, and pastes the message!

HOW TO INSTALL IN CHROME (Takes 30 seconds):
1. Extract / Unzip this folder to a folder on your computer (e.g. Documents/whatsapp-extension).
2. Open Google Chrome.
3. In the address bar, type: chrome://extensions and press Enter.
4. In the top-right corner, turn ON the "Developer mode" toggle.
5. In the top-left corner, click the "Load unpacked" button.
6. Select the extracted folder containing manifest.json.
7. Done! You will see "RSCC WhatsApp Single-Tab Companion" installed.

Now, whenever you click "Mark Ready" in RSCC Admin, it will navigate your existing
WhatsApp Web tab directly, with ZERO new tabs opened!`;

/**
 * Generates and triggers browser download of rscc-whatsapp-companion.zip
 */
export async function downloadWhatsAppExtensionZip(): Promise<boolean> {
  try {
    const zip = new JSZip();
    zip.file('manifest.json', EXTENSION_MANIFEST);
    zip.file('background.js', EXTENSION_BACKGROUND);
    zip.file('content.js', EXTENSION_CONTENT);
    zip.file('README.txt', EXTENSION_README);

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rscc-whatsapp-single-tab-extension.zip';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 1500);
    return true;
  } catch (err) {
    console.error('Failed to generate extension zip:', err);
    return false;
  }
}
