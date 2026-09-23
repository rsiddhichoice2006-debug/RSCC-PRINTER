chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'RSCC_NAVIGATE_WHATSAPP') {
    const { phone, message } = request;
    const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
    const targetUrl = `https://web.whatsapp.com/send?phone=91${cleanPhone}&text=${encodeURIComponent(message || '')}`;

    // Search for any tab where WhatsApp Web is already open
    chrome.tabs.query({ url: "*://web.whatsapp.com/*" }, (tabs) => {
      if (tabs && tabs.length > 0) {
        // Reuse the first already-opened WhatsApp tab in Chrome!
        const existingTab = tabs[0];
        chrome.tabs.update(existingTab.id, { url: targetUrl, active: true }, () => {
          if (existingTab.windowId) {
            chrome.windows.update(existingTab.windowId, { focused: true });
          }
        });
      } else {
        // No WhatsApp tab open yet; open one
        chrome.tabs.create({ url: targetUrl });
      }
    });

    sendResponse({ success: true, reusedTab: true });
    return true;
  }
});
