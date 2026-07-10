/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const TETRAID_BASE_URL_PREF = "identity.tetraid.auth.base_url";
const TETRAID_DEFAULT_BASE_URL = "https://tetraid-altzen-auth.vercel.app";
const TETRAID_PLACEHOLDER_STATE_PREF = "identity.tetraid.placeholder_state";
const TETRAID_PLACEHOLDER_DISPLAY_NAME_PREF =
  "identity.tetraid.placeholder_display_name";
const TETRAID_PLACEHOLDER_USERNAME_PREF =
  "identity.tetraid.placeholder_username";

const ACCOUNT_STATUS_ID = "appMenu-fxa-status2";
const ACCOUNT_TEXT_ID = "appMenu-fxa-text";
const ACCOUNT_ACTION_ID = "appMenu-fxa-label2";
const ACCOUNT_TITLE_ID = "appMenu-header-title";
const ACCOUNT_DESCRIPTION_ID = "appMenu-header-description";
const LEGACY_TETRAID_STATUS_ID = "appMenu-tetraid-status";

let gTetraIDServices;
let gTetraIDServicesResolved = false;

function warnTetraID(message, error) {
  console.warn(`TetraID: ${message}`, error);
}

function getTetraIDServices() {
  if (gTetraIDServicesResolved) {
    return gTetraIDServices;
  }

  gTetraIDServicesResolved = true;
  gTetraIDServices = globalThis.Services || globalThis.window?.Services;

  if (!gTetraIDServices && globalThis.ChromeUtils?.importESModule) {
    try {
      gTetraIDServices = ChromeUtils.importESModule(
        "resource://gre/modules/Services.sys.mjs"
      ).Services;
    } catch (error) {
      warnTetraID(
        "Services unavailable; account UI will use safe defaults.",
        error
      );
    }
  }

  return gTetraIDServices;
}

class ZenTetraIDStateAdapter {
  get state() {
    const services = getTetraIDServices();
    if (!services?.prefs) {
      return { status: "signedOut" };
    }

    if (
      services.prefs.getStringPref(
        TETRAID_PLACEHOLDER_STATE_PREF,
        "signedOut"
      ) == "signedIn"
    ) {
      return {
        status: "signedIn",
        displayName: services.prefs.getStringPref(
          TETRAID_PLACEHOLDER_DISPLAY_NAME_PREF,
          "AltZen"
        ),
        username: services.prefs.getStringPref(
          TETRAID_PLACEHOLDER_USERNAME_PREF,
          "@altzen"
        ),
      };
    }

    return { status: "signedOut" };
  }

  async refresh() {
    return this.state;
  }
}

class ZenTetraIDAccountMenu {
  #stateAdapter = new ZenTetraIDStateAdapter();
  #lastState = { status: "signedOut" };

  init() {
    document.addEventListener("popupshowing", event => {
      if (event.target.id == "appMenu-popup") {
        this.refreshTetraIDAccountState();
        window.setTimeout(() => this.refreshTetraIDAccountState(), 0);
      }
    });

    document.addEventListener("ViewShowing", event => {
      if (event.target.id == "appMenu-mainView") {
        this.refreshTetraIDAccountState();
        window.setTimeout(() => this.refreshTetraIDAccountState(), 0);
      }
    });

    const handleAccountActivation = event => this.handleAccountActivation(event);
    document.addEventListener("command", handleAccountActivation, true);
    document.addEventListener("click", handleAccountActivation, true);
  }

  get baseUrl() {
    const services = getTetraIDServices();
    if (!services?.prefs) {
      return TETRAID_DEFAULT_BASE_URL;
    }

    return services.prefs
      .getStringPref(TETRAID_BASE_URL_PREF, TETRAID_DEFAULT_BASE_URL)
      .replace(/\/$/, "");
  }

  async refreshTetraIDAccountState() {
    try {
      this.#lastState = await this.#stateAdapter.refresh();
    } catch (error) {
      warnTetraID("Account state refresh failed; using signed-out state.", error);
      this.#lastState = { status: "signedOut" };
    }

    this.renderMenuRow(this.#lastState);
    return this.#lastState;
  }

  renderMenuRow(state = this.#lastState) {
    const legacyTetraIDStatus = document.getElementById(
      LEGACY_TETRAID_STATUS_ID
    );
    if (legacyTetraIDStatus) {
      legacyTetraIDStatus.hidden = true;
    }

    const statusItem = document.getElementById(ACCOUNT_STATUS_ID);
    const text = document.getElementById(ACCOUNT_TEXT_ID);
    const actionButton = document.getElementById(ACCOUNT_ACTION_ID);
    const title = document.getElementById(ACCOUNT_TITLE_ID);
    const description = document.getElementById(ACCOUNT_DESCRIPTION_ID);

    if (!statusItem || !text || !actionButton || !title || !description) {
      return;
    }

    statusItem.hidden = false;
    statusItem.setAttribute("tetraid-entry", "true");
    statusItem.classList.add("toolbaritem-combined-buttons");
    statusItem.removeAttribute("fxastatus");
    statusItem.removeAttribute("tooltiptext");
    statusItem.removeAttribute("data-l10n-id");
    statusItem.removeAttribute("command");
    statusItem.removeAttribute("oncommand");

    text.removeAttribute("data-l10n-id");
    text.hidden = false;
    actionButton.removeAttribute("data-l10n-id");
    actionButton.removeAttribute("command");
    actionButton.removeAttribute("oncommand");
    actionButton.removeAttribute("key");
    actionButton.removeAttribute("aria-labelledby");
    actionButton.classList.remove("subviewbutton-nav");
    actionButton.classList.remove("subviewbutton-iconic");
    actionButton.classList.add("subviewbutton-iconic", "tetraid-chevron-button");
    actionButton.setAttribute("closemenu", "none");
    actionButton.hidden = false;
    actionButton.setAttribute("label", "");
    actionButton.setAttribute(
      "image",
      "chrome://global/skin/icons/arrow-right.svg"
    );

    title.hidden = true;
    description.hidden = true;

    if (state.status == "signedIn") {
      statusItem.setAttribute("tetraid-status", "signed-in");
      text.replaceChildren(this.#buildSignedInIdentity(state));
      actionButton.setAttribute("aria-label", "Open TetraID account");
      actionButton.setAttribute("title", "Open TetraID account");
      actionButton.setAttribute("tooltiptext", "Open TetraID account");
      return;
    }

    statusItem.setAttribute("tetraid-status", "signed-out");
    text.textContent = "Connect AltZen to your TetraID";
    actionButton.setAttribute("aria-label", "Sign in to TetraID");
    actionButton.setAttribute("title", "Sign in to TetraID");
    actionButton.setAttribute("tooltiptext", "Sign in to TetraID");
  }

  showSignInDialog() {
    const services = getTetraIDServices();
    if (!services?.prompt) {
      warnTetraID("Prompt service unavailable; sign-in dialog was not opened.");
      return;
    }

    const buttonFlags =
      services.prompt.BUTTON_POS_0 * services.prompt.BUTTON_TITLE_IS_STRING +
      services.prompt.BUTTON_POS_1 * services.prompt.BUTTON_TITLE_CANCEL;
    const buttonPressed = services.prompt.confirmEx(
      window,
      "Sign in to TetraID",
      "Use your TetraID to connect AltZen with your Tetra account.",
      buttonFlags,
      "Continue",
      null,
      null,
      null,
      {}
    );

    if (buttonPressed == 0) {
      this.openAuthStart();
    }
  }

  openAuthStart() {
    this.openTetraIDAuthFlow();
  }

  openTetraIDAuthFlow() {
    window.openTrustedLinkIn(`${this.baseUrl}/api/auth/login`, "tab");
  }

  openAccountHome() {
    window.openTrustedLinkIn(`${this.baseUrl}/`, "tab");
  }

  #buildSignedInIdentity(state) {
    const container = document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "div"
    );
    container.id = "tetraid-menu-identity";

    const avatar = document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "span"
    );
    avatar.id = "tetraid-menu-avatar";
    avatar.setAttribute("aria-hidden", "true");

    const copy = document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "span"
    );
    copy.id = "tetraid-menu-copy";

    const name = document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "span"
    );
    name.id = "tetraid-menu-name";
    name.textContent = state.displayName || "AltZen";

    const username = document.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "span"
    );
    username.id = "tetraid-menu-username";
    username.textContent = state.username || "@altzen";

    copy.append(name, username);
    container.append(avatar, copy);
    return container;
  }

  handleAccountActivation(event) {
    const target = event.target?.closest?.(
      `#${ACCOUNT_ACTION_ID}, #${ACCOUNT_STATUS_ID}`
    );
    if (!target) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (this.#lastState.status == "signedIn") {
      this.openAccountHome();
    } else {
      this.openTetraIDAuthFlow();
    }
  }
}

try {
  window.gZenTetraID = new ZenTetraIDAccountMenu();
  window.refreshTetraIDAccountState = () =>
    window.gZenTetraID.refreshTetraIDAccountState();
  window.gZenTetraID.init();
} catch (error) {
  warnTetraID("Initialization failed; browser chrome will continue.", error);
}
