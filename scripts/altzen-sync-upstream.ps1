param(
  [string] $UpstreamRemote = "upstream",
  [string] $UpstreamBranch = "dev",
  [string] $BaseBranch = "dev",
  [string] $BranchPrefix = "codex/sync-zen"
)

$ErrorActionPreference = "Stop"

function Fail($Message) {
  Write-Error $Message
  exit 1
}

$repoRoot = git rev-parse --show-toplevel
if (-not $repoRoot) {
  Fail "This script must be run inside a git repository."
}

Set-Location $repoRoot

$status = git status --porcelain
if ($status) {
  Fail "Working tree is not clean. Commit, stash, or archive local changes before syncing Zen."
}

$remoteNames = git remote
if ($remoteNames -notcontains $UpstreamRemote) {
  Fail "Missing '$UpstreamRemote' remote. Add it with: git remote add $UpstreamRemote https://github.com/zen-browser/desktop.git"
}

$date = Get-Date -Format "yyyyMMdd"
$syncBranch = "$BranchPrefix-$date"

Write-Host "Fetching $UpstreamRemote/$UpstreamBranch..."
git fetch $UpstreamRemote $UpstreamBranch --tags

Write-Host "Updating $BaseBranch..."
git switch $BaseBranch
git pull --ff-only origin $BaseBranch

$existingBranch = git branch --list $syncBranch
if ($existingBranch) {
  Fail "Branch '$syncBranch' already exists. Delete it, rename it, or run with a different -BranchPrefix."
}

Write-Host "Creating $syncBranch..."
git switch --create $syncBranch

Write-Host "Merging $UpstreamRemote/$UpstreamBranch..."
git merge "$UpstreamRemote/$UpstreamBranch"

Write-Host ""
Write-Host "Sync branch ready: $syncBranch"
Write-Host "Next steps:"
Write-Host "  1. Resolve conflicts if git reported any."
Write-Host "  2. Run git diff --check."
Write-Host "  3. Build and smoke test AltZen if browser chrome or build files changed."
Write-Host "  4. Open a PR from $syncBranch into $BaseBranch."
