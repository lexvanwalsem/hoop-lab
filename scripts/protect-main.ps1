# Protects the main branch the same way as the other repos: pull request with one approving review from a code owner,
# the "test" check must pass, conversations must be resolved, no force pushes, no deletion.
# GitHub only allows this on public repositories (or with GitHub Pro), so run it right after the repository goes public.
# Usage: .\scripts\protect-main.ps1   (needs the gh CLI, logged in as the repository owner)
param([string]$Repo = 'lexvanwalsem/hoop-lab')

$rules = @{
  required_status_checks = @{ strict = $false; contexts = @('test') }
  enforce_admins = $false
  required_pull_request_reviews = @{ dismiss_stale_reviews = $true; require_code_owner_reviews = $true; required_approving_review_count = 1 }
  restrictions = $null
  required_conversation_resolution = $true
  allow_force_pushes = $false
  allow_deletions = $false
} | ConvertTo-Json -Depth 5

$rules | gh api -X PUT "repos/$Repo/branches/main/protection" --input -
