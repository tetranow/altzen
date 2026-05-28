const providerEl = document.getElementById("provider");
const selectionStateEl = document.getElementById("selection-state");
const statusEl = document.getElementById("status");

const state = window.top.gZenAISidebarManager.getLauncherState();

for (const provider of state.providers) {
  const option = document.createElement("option");
  option.value = provider.value;
  option.textContent = provider.ready
    ? provider.label
    : `${provider.label} (coming soon)`;
  option.disabled = !provider.ready;
  option.selected = provider.value === state.provider;
  providerEl.appendChild(option);
}

providerEl.addEventListener("change", event => {
  window.top.gZenAISidebarManager.setProvider(event.target.value);
});

for (const button of document.querySelectorAll("[data-action]")) {
  button.addEventListener("click", event => {
    const action = event.currentTarget.dataset.action;
    const result = window.top.gZenAISidebarManager.triggerAction(action);
    statusEl.textContent = result.message;
  });
}

if (state.hasSelection) {
  selectionStateEl.textContent =
    "Selected text detected. t3.chat will use it first.";
}

statusEl.textContent = "t3.chat is ready for the first live handoff.";
