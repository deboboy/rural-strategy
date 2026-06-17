(function () {
  function wrapTables(container) {
    container.querySelectorAll('table').forEach((table) => {
      if (table.parentElement?.classList.contains('doc-table-scroll')) {
        return;
      }
      const wrapper = document.createElement('div');
      wrapper.className = 'doc-table-scroll';
      wrapper.setAttribute('tabindex', '0');
      wrapper.setAttribute('aria-label', 'Scrollable table');
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    });
  }

  function renderMarkdownDoc(container, markdown) {
    if (!window.marked || !window.DOMPurify) {
      container.textContent = markdown;
      return;
    }

    container.innerHTML = window.DOMPurify.sanitize(
      window.marked.parse(markdown, { breaks: true, gfm: true })
    );
    wrapTables(container);
    container.removeAttribute('aria-busy');
  }

  async function loadMarkdownDoc(container, url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Document not found');
    }
    const markdown = await response.text();
    renderMarkdownDoc(container, markdown);
  }

  window.renderMarkdownDoc = renderMarkdownDoc;
  window.loadMarkdownDoc = loadMarkdownDoc;
})();
