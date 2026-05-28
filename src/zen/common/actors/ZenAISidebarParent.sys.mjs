// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const AI_SIDEBAR_BROWSER_ID = "zen-ai-sidebar-browser";

export class ZenAISidebarParent extends JSWindowActorParent {
  get #topChromeWindow() {
    return this.browsingContext.topChromeWindow;
  }

  get #embedderElement() {
    return this.browsingContext.top.embedderElement;
  }

  get #manager() {
    return this.#topChromeWindow?.gZenAISidebarManager ?? null;
  }

  get #isAISidebarBrowser() {
    return this.#embedderElement?.id === AI_SIDEBAR_BROWSER_ID;
  }

  async receiveMessage(message) {
    if (!this.#isAISidebarBrowser) {
      return null;
    }

    switch (message.name) {
      case "ZenAISidebar:ProviderReady": {
        const provider = message.data?.provider;
        const payload =
          this.#manager?.consumePendingPayloadForProvider(provider) ?? null;

        if (payload) {
          this.sendAsyncMessage("ZenAISidebar:PerformAction", payload);
        }
        break;
      }
      case "ZenAISidebar:AutomationResult": {
        const { ok, detail } = message.data ?? {};
        console.debug(
          `[ZenAISidebarParent]: ${ok ? "completed" : "failed"} automation`,
          detail ?? ""
        );
        break;
      }
    }

    return null;
  }
}
