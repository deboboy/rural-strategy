window.getMapChatContext = function getMapChatContext() {
  if (window.__ruralMapContext) {
    return window.__ruralMapContext;
  }
  return {
    page: window.location.pathname,
  };
};

window.setMapChatContext = function setMapChatContext(partial) {
  window.__ruralMapContext = {
    page: window.location.pathname,
    ...window.__ruralMapContext,
    ...partial,
  };
};
