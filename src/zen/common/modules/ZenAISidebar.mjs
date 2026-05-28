// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const AI_SIDEBAR_BROWSER_ID = "zen-ai-sidebar-browser";
const AI_SIDEBAR_URL = "chrome://browser/content/zen-ai/launcher.xhtml";
const AI_PROVIDER_PREF = "zen.ai.sidebar.provider";
const AI_SIDEBAR_WIDTH = "380px";
const AI_PROVIDER_URLS = {
  t3: "https://t3.chat/",
  venice: "https://venice.ai/",
  chatgpt: "https://chatgpt.com/",
  claude: "https://claude.ai/",
};

class ZenAISidebarManager {
  #elements = null;
  #previousHeaderHidden = null;
  #previousSidebarState = null;
  #pendingAction = null;
  #pendingContext = null;

  get provider() {
    const preferred = Services.prefs.getStringPref(AI_PROVIDER_PREF, "t3");
    return this.providers.find(provider => provider.value === preferred && provider.ready)
      ? preferred
      : "t3";
  }

  set provider(value) {
    const nextProvider = this.providers.find(
      provider => provider.value === value && provider.ready
    )
      ? value
      : "t3";
    Services.prefs.setStringPref(AI_PROVIDER_PREF, nextProvider);
  }

  get providers() {
    return [
      { value: "t3", label: "t3.chat", ready: true },
      { value: "venice", label: "venice.ai", ready: false },
      { value: "chatgpt", label: "chatgpt.com", ready: false },
      { value: "claude", label: "claude.ai", ready: false },
    ];
  }

  init() {
    if (window.location.href !== "chrome://browser/content/browser.xhtml") {
      return;
    }

    if (document.readyState !== "loading") {
      this.#ensureElements();
      return;
    }

    window.addEventListener(
      "DOMContentLoaded",
      () => {
        this.#ensureElements();
      },
      { once: true }
    );
  }

  toggle() {
    if (this.isOpen()) {
      this.hide();
      return;
    }

    this.showLauncher();
  }

  isOpen() {
    const elements = this.#ensureElements();
    return Boolean(
      elements?.browser &&
        !elements.browser.hidden &&
        elements.sidebarBox.getAttribute("zen-ai-sidebar") === "true"
    );
  }

  showLauncher() {
    const elements = this.#ensureElements();
    if (!elements) {
      return;
    }

    this.#capturePreviousSidebarState(elements);
    this.#prepareChrome(elements);

    elements.browser.hidden = false;
    elements.browser.setAttribute("src", AI_SIDEBAR_URL);
    elements.sidebarBox.hidden = false;
    elements.sidebarSplitter.hidden = false;
    elements.sidebarBox.style.width = AI_SIDEBAR_WIDTH;
    elements.sidebarBox.setAttribute("zen-ai-sidebar", "true");
  }

  hide() {
    const elements = this.#ensureElements();
    if (!elements?.browser) {
      return;
    }

    elements.browser.hidden = true;
    elements.browser.removeAttribute("src");
    elements.sidebarBox.removeAttribute("zen-ai-sidebar");
    this.#pendingAction = null;
    this.#pendingContext = null;

    if (elements.originalSidebar) {
      elements.originalSidebar.hidden = false;
    }

    if (this.#previousHeaderHidden !== null) {
      elements.sidebarHeader.hidden = this.#previousHeaderHidden;
      this.#previousHeaderHidden = null;
    }

    if (this.#previousSidebarState?.wasVisible) {
      this.#previousSidebarState = null;
      return;
    }

    if (elements.originalSidebar?.hidden !== false) {
      elements.sidebarBox.hidden = true;
      elements.sidebarSplitter.hidden = true;
    }

    this.#previousSidebarState = null;
  }

  getLauncherState() {
    return {
      provider: this.provider,
      providers: this.providers,
      hasSelection: Boolean(this.getPageContext().selection),
    };
  }

  setProvider(value) {
    this.provider = value;
  }

  triggerAction(action) {
    const context = this.getPageContext();
    const actionLabels = {
      summarize: "Summarize this",
      explain: "Explain this",
      ask: "Ask about this page",
    };
    const providerLabel =
      this.providers.find(provider => provider.value === this.provider)?.label ??
      this.provider;

    this.#pendingAction = action;
    this.#pendingContext = context;
    this.showProvider();

    return {
      message:
        `${actionLabels[action] ?? "AI action"} in ${providerLabel} is loading. ` +
        `${context.selection ? "Selection captured." : "No selection captured yet."}`,
    };
  }

  showProvider() {
    const elements = this.#ensureElements();
    if (!elements) {
      return;
    }

    const url = AI_PROVIDER_URLS[this.provider] || AI_PROVIDER_URLS.t3;

    this.#capturePreviousSidebarState(elements);
    this.#prepareChrome(elements);

    elements.browser.hidden = false;
    elements.sidebarBox.hidden = false;
    elements.sidebarSplitter.hidden = false;
    elements.sidebarBox.style.width = AI_SIDEBAR_WIDTH;
    elements.sidebarBox.setAttribute("zen-ai-sidebar", "true");
    elements.browser.setAttribute("src", url);
  }

  returnToLauncher() {
    if (!this.isOpen()) {
      return;
    }
    this.showLauncher();
  }

  getPendingPayload() {
    return {
      provider: this.provider,
      action: this.#pendingAction,
      context: this.#pendingContext,
    };
  }

  consumePendingPayloadForProvider(provider) {
    if (!this.#pendingAction || !this.#pendingContext) {
      return null;
    }

    if (provider !== this.provider) {
      return null;
    }

    const payload = {
      provider,
      action: this.#pendingAction,
      context: this.#pendingContext,
      prompt: this.#buildPrompt(this.#pendingAction, this.#pendingContext),
    };

    this.#pendingAction = null;
    this.#pendingContext = null;

    return payload;
  }

  getPageContext() {
    const selection = window.content?.getSelection?.()?.toString?.().trim?.() || "";
    const browser = gBrowser?.selectedBrowser;

    return {
      title: browser?.contentTitle || gBrowser?.selectedTab?.label || "",
      url: browser?.currentURI?.spec || "",
      selection,
    };
  }

  #buildPrompt(action, context) {
    const lines = [];
    const cleanTitle = (context.title || "").trim();
    const cleanUrl = (context.url || "").trim();
    const cleanSelection = (context.selection || "").trim();

    switch (action) {
      case "summarize":
        lines.push(
          cleanSelection
            ? "Summarize the selected text from the page below."
            : "Summarize the page context below as clearly as possible."
        );
        break;
      case "explain":
        lines.push(
          cleanSelection
            ? "Explain the selected text from the page below in simple terms."
            : "Explain the page context below in simple terms."
        );
        break;
      case "ask":
      default:
        lines.push("Help me understand the page context below.");
        break;
    }

    lines.push("Keep the answer concise and useful.");

    if (cleanTitle) {
      lines.push(`Page title: ${cleanTitle}`);
    }

    if (cleanUrl) {
      lines.push(`Page URL: ${cleanUrl}`);
    }

    if (cleanSelection) {
      lines.push("Selected text:");
      lines.push(cleanSelection.slice(0, 12000));
    } else {
      lines.push(
        "No text was selected. Use the page title and URL as context, and say if you need more page content."
      );
    }

    return lines.join("\n\n").trim();
  }

  #capturePreviousSidebarState(elements) {
    if (this.#previousSidebarState) {
      return;
    }

    this.#previousSidebarState = {
      wasVisible:
        !elements.sidebarBox.hidden &&
        Boolean(elements.originalSidebar && !elements.originalSidebar.hidden),
    };
  }

  #prepareChrome(elements) {
    if (this.#previousHeaderHidden === null) {
      this.#previousHeaderHidden = elements.sidebarHeader.hidden;
    }

    elements.sidebarHeader.hidden = true;

    if (elements.originalSidebar) {
      elements.originalSidebar.hidden = true;
    }
  }

  #ensureElements() {
    if (this.#elements) {
      return this.#elements;
    }

    const sidebarBox = document.getElementById("sidebar-box");
    const sidebarHeader = document.getElementById("sidebar-header");
    const sidebarSplitter = document.getElementById("sidebar-splitter");

    if (!sidebarBox || !sidebarHeader || !sidebarSplitter) {
      return null;
    }

    let browser = document.getElementById(AI_SIDEBAR_BROWSER_ID);
    if (!browser) {
      browser = document.createXULElement("browser");
      browser.id = AI_SIDEBAR_BROWSER_ID;
      browser.setAttribute("type", "content");
      browser.setAttribute("disablehistory", "true");
      browser.setAttribute("flex", "1");
      browser.hidden = true;
      sidebarBox.appendChild(browser);
    }

    const originalSidebar = Array.from(sidebarBox.children).find(
      child => child.localName === "browser" && child.id !== AI_SIDEBAR_BROWSER_ID
    );

    this.#elements = {
      sidebarBox,
      sidebarHeader,
      sidebarSplitter,
      browser,
      originalSidebar,
    };

    return this.#elements;
  }
}

window.gZenAISidebarManager = new ZenAISidebarManager();
window.gZenAISidebarManager.init();
