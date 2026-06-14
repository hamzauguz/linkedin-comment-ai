const BUTTON_CLASS = "lcai-generate-btn";
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
  button.title = "Comment generation will be enabled in the next feature branch";

  toolbar.appendChild(button);
  wrapper.insertBefore(toolbar, wrapper.firstChild);
}

function scanAndInject() {
  findCommentBoxes().forEach(injectButton);
}

const observer = new MutationObserver(scanAndInject);
observer.observe(document.body, { childList: true, subtree: true });
scanAndInject();
