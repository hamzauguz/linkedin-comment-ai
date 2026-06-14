(function initLcaiContent() {
  if (!chrome?.runtime?.id) return;

  if (window.__LCAI_CONTENT__) {
    window.dispatchEvent(new CustomEvent("lcai:cleanup"));
    return;
  }
  window.__LCAI_CONTENT__ = true;

  const LCAI_VERSION = "0.3.2";
  const BUTTON_CLASS = "lcai-generate-btn";
  const PANEL_CLASS = "lcai-panel";
  const PROCESSED_EDITORS = new WeakSet();
  let scanScheduled = false;
  let domObserver = null;

  function cleanupLcaiUi() {
    domObserver?.disconnect();
    document.querySelectorAll(".lcai-toolbar, .lcai-panel").forEach((el) => el.remove());
  }

  window.addEventListener("lcai:cleanup", cleanupLcaiUi);

  function findCommentBoxes() {
    const selectors = [
      ".comments-comment-box__form .ql-editor",
      ".comments-comment-texteditor .ql-editor",
      'div[contenteditable="true"][data-placeholder*="comment" i]',
      'div[contenteditable="true"][aria-label*="comment" i]',
    ];

    const boxes = new Set();
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((el) => boxes.add(el));
    }
    return [...boxes];
  }

  const POST_CONTAINER_SELECTORS = [
    '[data-view-name="feed-full-update"]',
    ".feed-shared-update-v2",
    ".occludable-update",
    'div[data-id^="urn:li:activity"]',
    'div[data-urn^="urn:li:activity"]',
    'div[data-urn^="urn:li:aggregatedShare"]',
    'article[data-urn*="activity"]',
    "article",
  ];

  const AUTHOR_SELECTORS = [
    '[data-view-name="feed-header-actor"] a[href*="/in/"] span',
    '[data-view-name="feed-actor-image"] + a span',
    ".update-components-actor__title span[aria-hidden='true']",
    ".update-components-actor__title a span",
    ".update-components-actor__name",
    ".feed-shared-actor__name span",
    ".feed-shared-actor__title span",
    '[data-anonymize="person-name"]',
    'a[href*="/in/"] span[dir="ltr"]',
  ];

  const POST_TEXT_SELECTORS = [
    '[data-testid="expandable-text-box"]',
    '[data-view-name="feed-commentary"]',
    ".update-components-update-v2__commentary",
    ".feed-shared-update-v2__description .update-components-text",
    ".feed-shared-inline-show-more-text",
    ".feed-shared-text .update-components-text",
    ".feed-shared-text",
    ".update-components-text",
    ".break-words",
  ];

  function queryFirst(root, selectors) {
    for (const selector of selectors) {
      const el = root.querySelector(selector);
      if (el?.textContent?.trim()) return el;
    }
    return null;
  }

  function normalizeText(text) {
    return text.replace(/\s+/g, " ").trim();
  }

  function findPostContainer(commentBox) {
    for (const selector of POST_CONTAINER_SELECTORS) {
      const match = commentBox.closest(selector);
      if (match) return match;
    }

    for (const post of document.querySelectorAll(POST_CONTAINER_SELECTORS.join(", "))) {
      if (post.contains(commentBox)) return post;
    }

    let node = commentBox.parentElement;
    for (let depth = 0; depth < 20 && node; depth += 1) {
      if (queryFirst(node, POST_TEXT_SELECTORS)) return node;
      node = node.parentElement;
    }

    return null;
  }

  function extractAuthorName(container) {
    const authorEl = queryFirst(container, AUTHOR_SELECTORS);
    if (authorEl) return normalizeText(authorEl.textContent);

    const profileLink = container.querySelector('a[href*="/in/"]:not([href*="/company/"])');
    const linkText = profileLink?.textContent?.split("\n")[0];
    return linkText ? normalizeText(linkText) : "";
  }

  function extractPostText(container) {
    const textEl = queryFirst(container, POST_TEXT_SELECTORS);
    if (textEl) return normalizeText(textEl.textContent);

    const clone = container.cloneNode(true);
    clone
      .querySelectorAll(
        ".comments-comments-list, .comments-comment-box, .comments-replies-list, .feed-shared-social-action-bar, .social-details-social-counts, button, svg"
      )
      .forEach((el) => el.remove());

    const fallback = normalizeText(clone.textContent || "");
    return fallback.slice(0, 2500);
  }

  function extractPostContext(commentBox) {
    const container = findPostContainer(commentBox);
    if (!container) {
      return { authorName: "", postText: "" };
    }

    return {
      authorName: extractAuthorName(container),
      postText: extractPostText(container),
    };
  }

  function insertTextIntoEditor(editor, text) {
    editor.focus();
    editor.textContent = text;
    editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }

  function removePanel(panel) {
    panel?.remove();
  }

  function createPanel(anchor) {
    removePanel(anchor.parentElement?.querySelector(`.${PANEL_CLASS}`));

    const panel = document.createElement("div");
    panel.className = PANEL_CLASS;
    panel.innerHTML = `
      <div class="lcai-panel__header">
        <span>Suggestions</span>
        <button type="button" class="lcai-panel__close" aria-label="Close">×</button>
      </div>
      <div class="lcai-panel__body">
        <p class="lcai-panel__loading">Generating comments…</p>
      </div>
    `;

    panel.querySelector(".lcai-panel__close").addEventListener("click", () => {
      removePanel(panel);
    });

    anchor.insertAdjacentElement("afterend", panel);
    return panel;
  }

  function renderSuggestions(panel, suggestions, commentBox) {
    const body = panel.querySelector(".lcai-panel__body");
    body.innerHTML = "";

    if (!suggestions?.length) {
      body.innerHTML = `<p class="lcai-panel__error">No suggestions returned.</p>`;
      return;
    }

    suggestions.forEach((text) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "lcai-panel__suggestion";
      item.textContent = text;
      item.addEventListener("click", () => {
        insertTextIntoEditor(commentBox, text);
        removePanel(panel);
      });
      body.appendChild(item);
    });
  }

  function renderError(panel, message) {
    const body = panel.querySelector(".lcai-panel__body");
    body.innerHTML = `<p class="lcai-panel__error">${message}</p>`;
  }

  function injectButton(commentBox) {
    if (PROCESSED_EDITORS.has(commentBox)) return;

    const wrapper =
      commentBox.closest(".comments-comment-box__form") ||
      commentBox.closest(".comments-comment-texteditor") ||
      commentBox.parentElement;

    if (!wrapper) return;

    PROCESSED_EDITORS.add(commentBox);

    const toolbar = document.createElement("div");
    toolbar.className = "lcai-toolbar";

    const button = document.createElement("button");
    button.type = "button";
    button.className = BUTTON_CLASS;
    button.textContent = "✨ Generate";

    let isGenerating = false;

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (isGenerating || !chrome?.runtime?.id) return;
      if (typeof window.lcaiGenerateComments !== "function") {
        renderError(createPanel(toolbar), "Extension not ready. Hard-refresh this tab.");
        return;
      }

      isGenerating = true;
      button.disabled = true;

      const panel = createPanel(toolbar);
      const context = extractPostContext(commentBox);

      try {
        const suggestions = await window.lcaiGenerateComments(context);
        renderSuggestions(panel, suggestions, commentBox);
      } catch (error) {
        renderError(panel, error?.message || "Extension error. Hard-refresh this tab.");
      } finally {
        isGenerating = false;
        button.disabled = false;
      }
    });

    toolbar.appendChild(button);
    wrapper.insertBefore(toolbar, wrapper.firstChild);
  }

  function scanAndInject() {
    findCommentBoxes().forEach(injectButton);
  }

  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(() => {
      scanScheduled = false;
      scanAndInject();
    });
  }

  domObserver = new MutationObserver((mutations) => {
    const hasRelevantChange = mutations.some((mutation) =>
      [...mutation.addedNodes].some(
        (node) =>
          node.nodeType === Node.ELEMENT_NODE &&
          (node.matches?.(".comments-comment-box__form, .comments-comment-texteditor, .ql-editor") ||
            node.querySelector?.(".comments-comment-box__form, .comments-comment-texteditor, .ql-editor"))
      )
    );

    if (hasRelevantChange) scheduleScan();
  });

  domObserver.observe(document.body, { childList: true, subtree: true });
  scheduleScan();

  console.info(`[LinkedIn Comment AI] v${LCAI_VERSION} ready`);
})();
