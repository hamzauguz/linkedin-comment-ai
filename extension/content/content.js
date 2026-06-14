const BUTTON_CLASS = "lcai-generate-btn";
const PANEL_CLASS = "lcai-panel";
const PROCESSED_ATTR = "data-lcai-processed";

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

function findPostContainer(commentBox) {
  return (
    commentBox.closest(".feed-shared-update-v2") ||
    commentBox.closest("article") ||
    commentBox.closest(".comments-comment-box")?.closest(".feed-shared-update-v2") ||
    commentBox.closest('[data-urn*="activity"]')
  );
}

function extractPostContext(commentBox) {
  const container = findPostContainer(commentBox);
  if (!container) {
    return { authorName: "", postText: "" };
  }

  const authorEl =
    container.querySelector(".update-components-actor__title span") ||
    container.querySelector(".feed-shared-actor__name") ||
    container.querySelector('[data-anonymize="person-name"]');

  const textEl =
    container.querySelector(".feed-shared-update-v2__description") ||
    container.querySelector(".feed-shared-text") ||
    container.querySelector(".update-components-text");

  const authorName = authorEl?.textContent?.trim().replace(/\s+/g, " ") || "";
  const postText = textEl?.textContent?.trim().replace(/\s+/g, " ") || "";

  return { authorName, postText };
}

function insertTextIntoEditor(editor, text) {
  editor.focus();
  editor.textContent = text;
  editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
}

function removePanel(panel) {
  panel?.remove();
}

function createPanel(anchor, commentBox) {
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
  if (commentBox.closest(`[${PROCESSED_ATTR}]`)) return;

  const wrapper =
    commentBox.closest(".comments-comment-box__form") ||
    commentBox.closest(".comments-comment-texteditor") ||
    commentBox.parentElement;

  if (!wrapper) return;

  wrapper.setAttribute(PROCESSED_ATTR, "true");

  const toolbar = document.createElement("div");
  toolbar.className = "lcai-toolbar";

  const button = document.createElement("button");
  button.type = "button";
  button.className = BUTTON_CLASS;
  button.textContent = "✨ Generate";

  button.addEventListener("click", async () => {
    button.disabled = true;
    const panel = createPanel(toolbar, commentBox);
    const context = extractPostContext(commentBox);

    try {
      const response = await chrome.runtime.sendMessage({
        type: "GENERATE_COMMENTS",
        payload: context,
      });

      if (!response?.ok) {
        renderError(panel, response?.error || "Failed to generate comments.");
        return;
      }

      renderSuggestions(panel, response.suggestions, commentBox);
    } catch {
      renderError(panel, "Extension error. Try reloading the page.");
    } finally {
      button.disabled = false;
    }
  });

  toolbar.appendChild(button);
  wrapper.insertBefore(toolbar, wrapper.firstChild);
}

function scanAndInject() {
  findCommentBoxes().forEach(injectButton);
}

const observer = new MutationObserver(() => {
  scanAndInject();
});

observer.observe(document.body, { childList: true, subtree: true });
scanAndInject();
