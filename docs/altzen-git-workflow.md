# AltZen Git Workflow

AltZen should be maintained as a downstream fork of Zen Browser, not as a one-off modified checkout.

The goal is:

- Keep `dev` as the stable AltZen branch, matching Zen's default development branch.
- Keep Zen Browser as the upstream source of truth.
- Bring upstream Zen updates in through reviewable sync PRs.
- Keep AltZen features isolated in small branches and PRs.
- Never lose old AltZen experiments, even if the public GitHub repo is reset.

## Current Recommended Repo Shape

```txt
origin      https://github.com/tetranow/altzen.git
upstream    https://github.com/zen-browser/desktop.git
```

```txt
dev                          AltZen stable branch.
upstream/dev                 Zen Browser development branch.
codex/sync-zen-YYYYMMDD      Temporary branch for pulling in Zen updates.
codex/feature-name           Temporary branch for one AltZen change.
archive/altzen-1.0.32        Local preservation branch or tag for old AltZen state.
```

## One-Time Clean Reset Plan

This is the cleanest way to restart the public repo as a real Zen fork while preserving local AltZen progress.

1. Preserve the current local state.

   ```powershell
   git status --short --branch
   git branch archive/altzen-1.0.32
   git tag archive-altzen-1.0.32
   git diff > E:\Cursor\AltZenApp\altzen-1.0.32-working-tree.patch
   git diff --cached > E:\Cursor\AltZenApp\altzen-1.0.32-index.patch
   ```

2. Add Zen as upstream.

   ```powershell
   git remote add upstream https://github.com/zen-browser/desktop.git
   git fetch upstream dev --tags
   ```

3. Reset the local `dev` branch to Zen's `dev`.

   ```powershell
   git switch --create dev upstream/dev
   ```

   If `dev` already exists locally:

   ```powershell
   git switch dev
   git reset --hard upstream/dev
   ```

4. Force-update the public AltZen repo only after the archive branch, tag, and patch files exist.

   ```powershell
   git push origin dev --force-with-lease
   git push origin archive/altzen-1.0.32
   git push origin archive-altzen-1.0.32
   ```

Use `--force-with-lease`, not plain `--force`, so Git refuses to overwrite remote work that changed after the last fetch.

## Normal Upstream Sync

Run this regularly, ideally before starting larger AltZen work.

```powershell
git fetch upstream dev --tags
git switch dev
git pull --ff-only origin dev
git switch --create codex/sync-zen-YYYYMMDD
git merge upstream/dev
```

Then:

1. Resolve conflicts.
2. Run focused syntax checks for touched JavaScript modules.
3. Run `git diff --check`.
4. Run the AltZen build script when the change touches browser chrome, build config, packaging, or source patches.
5. Open a PR from `codex/sync-zen-YYYYMMDD` into `dev`.

## Normal Feature Development

Every AltZen change starts from a current `dev`.

```powershell
git fetch origin dev
git switch dev
git pull --ff-only origin dev
git switch --create codex/feature-short-name
```

Rules:

- One branch should represent one feature, bugfix, or integration step.
- Prefer new AltZen-owned files for AltZen behavior.
- Patch Zen/Firefox files only at narrow integration points.
- Avoid startup network calls, heavy imports, and broad browser chrome rewrites.
- Do not mix branding, installer work, TetraID, browser UI, and updater behavior in one PR unless they are inseparable.

Before PR:

```powershell
git diff --check
```

Also run targeted checks such as:

```powershell
node --check src\zen\common\modules\ZenTetraID.mjs
```

For browser chrome changes, run a local build and fresh-profile smoke test before calling the PR ready.

## PR Categories

Use small PRs with predictable labels or titles:

```txt
sync: merge Zen upstream YYYY-MM-DD
branding: AltZen release branding
chrome: AI sidebar shell
account: TetraID native account entrypoint
packaging: Windows versioned installer
updater: suppress upstream updater UI
shortcuts: keyboard shortcut migration
```

## Conflict Policy

When upstream Zen conflicts with AltZen:

1. Preserve Zen behavior by default.
2. Reapply AltZen behavior only when it is intentional and documented.
3. Move repeated AltZen behavior into an AltZen-owned module if the same conflict returns.
4. If a conflict affects startup, tabs, sidebar, address bar, app menu, or fullscreen, stop feature work and stabilize the browser first.

## Downstream Map

Maintain a small map of AltZen-owned and AltZen-patched areas:

```txt
AltZen-owned:
  scripts/package-altzen-windows.ps1
  scripts/create-altzen-nsis-installer.ps1
  src/zen/common/modules/ZenTetraID.mjs
  src/zen/common/styles/zen-tetraid.css
  tetraid-backend/

AltZen-patched:
  surfer.json
  prefs/zen/zen.yaml
  prefs/zen/updates.yaml
  src/zen/common/ZenPreloadedScripts.js
  src/zen/common/modules/ZenUIManager.mjs
  src/zen/kbs/ZenKeyboardShortcuts.mjs
  src/zen/common/styles/zen-browser-ui.css
```

Keep this list current. It is the first place to look during upstream sync conflicts.

## Release Build Rule

Completed compiled builds still go under:

```txt
E:\Cursor\AltZenApp\
```

Each successful packaged build gets the next patch version folder, for example:

```txt
E:\Cursor\AltZenApp\1.0.33\
```

Do not overwrite older version folders.
