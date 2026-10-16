(() => {
  'use strict';

  const SHOW_OVERLAY_MESSAGE = 'era-show-overlay';

  async function showOverlayInTab(tabId) {
    if (!Number.isInteger(tabId)) {
      return false;
    }
    try {
      await chrome.tabs.sendMessage(tabId, { type: SHOW_OVERLAY_MESSAGE });
      return true;
    } catch {
      return false;
    }
  }

  chrome.action.onClicked.addListener((tab) => {
    void showOverlayInTab(tab.id);
  });

  globalThis.RecordingAssistantBackground = Object.freeze({
    SHOW_OVERLAY_MESSAGE,
    showOverlayInTab,
  });
})();
