// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

const T3_PROVIDER = "t3";
const T3_URL_FRAGMENT = "t3.chat";
const INPUT_SELECTOR = '[aria-label="Message input"]';
const SUBMIT_SELECTOR = 'button[type="submit"]';

export class ZenAISidebarChild extends JSWindowActorChild {
  handleEvent(event) {
    if (event.type !== "DOMContentLoaded") {
      return;
    }

    const provider = this.#detectProvider();
    if (!provider) {
      return;
    }

    this.sendAsyncMessage("ZenAISidebar:ProviderReady", { provider });
  }

  async receiveMessage(message) {
    switch (message.name) {
      case "ZenAISidebar:PerformAction":
        return this.#performAction(message.data);
      default:
        return null;
    }
  }

  #detectProvider() {
    const href = this.contentWindow?.location?.href ?? "";

    if (href.includes(T3_URL_FRAGMENT)) {
      return T3_PROVIDER;
    }

    return null;
  }

  async #performAction(data) {
    const provider = this.#detectProvider();
    if (provider !== T3_PROVIDER || data?.provider !== T3_PROVIDER) {
      this.sendAsyncMessage("ZenAISidebar:AutomationResult", {
        ok: false,
        detail: "Unsupported provider for current page.",
      });
      return null;
    }

    const prompt = (data.prompt || "").trim();
    if (!prompt) {
      this.sendAsyncMessage("ZenAISidebar:AutomationResult", {
        ok: false,
        detail: "Prompt was empty.",
      });
      return null;
    }

    const input = await this.#waitForElement(INPUT_SELECTOR);
    if (!input) {
      this.sendAsyncMessage("ZenAISidebar:AutomationResult", {
        ok: false,
        detail: "Could not find the message input.",
      });
      return null;
    }

    this.#setFieldValue(input, prompt);

    const submitButton = await this.#waitForEnabledSubmit();
    if (!submitButton) {
      this.sendAsyncMessage("ZenAISidebar:AutomationResult", {
        ok: false,
        detail: "Could not find an enabled send button.",
      });
      return null;
    }

    submitButton.click();

    this.sendAsyncMessage("ZenAISidebar:AutomationResult", {
      ok: true,
      detail: "Prompt sent to t3.chat.",
    });

    return null;
  }

  #setFieldValue(input, value) {
    input.focus();

    const prototype = Object.getPrototypeOf(input);
    const valueDescriptor = Object.getOwnPropertyDescriptor(prototype, "value");

    if (valueDescriptor?.set) {
      valueDescriptor.set.call(input, value);
    } else {
      input.value = value;
    }

    const eventOptions = { bubbles: true, composed: true };
    input.dispatchEvent(new this.contentWindow.InputEvent("input", eventOptions));
    input.dispatchEvent(new this.contentWindow.Event("change", eventOptions));
  }

  async #waitForEnabledSubmit(maxAttempts = 40, delayMs = 150) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const button = this.document.querySelector(SUBMIT_SELECTOR);
      if (button && !button.disabled) {
        return button;
      }

      await this.#delay(delayMs);
    }

    return null;
  }

  async #waitForElement(selector, maxAttempts = 80, delayMs = 150) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const element = this.document.querySelector(selector);
      if (element) {
        return element;
      }

      await this.#delay(delayMs);
    }

    return null;
  }

  #delay(delayMs) {
    return new Promise(resolve => {
      this.contentWindow.setTimeout(resolve, delayMs);
    });
  }
}
