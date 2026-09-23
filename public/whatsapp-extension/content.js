// Listen for message dispatch from RSCC Admin Dashboard
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'RSCC_DISPATCH_WHATSAPP') {
    chrome.runtime.sendMessage({
      action: 'RSCC_NAVIGATE_WHATSAPP',
      phone: event.data.phone,
      message: event.data.message
    }, () => {
      if (chrome.runtime.lastError) {
        // Silently ignore or log
      }
    });
  }
});

// Broadcast to webpage that the extension is active
function pingActive() {
  window.postMessage({ type: 'RSCC_EXTENSION_ACTIVE', version: '1.0.0' }, '*');
}

pingActive();
setInterval(pingActive, 3000);
