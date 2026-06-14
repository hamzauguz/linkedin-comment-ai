#!/usr/bin/env bash
set -euo pipefail

# Run from repo root after: gh auth login

REPO_NAME="${1:-linkedin-comment-ai}"

gh repo create "$REPO_NAME" --public --source=. --remote=origin --description "Free Chrome extension: LinkedIn comment suggestions via your OpenAI API key"

git push -u origin main
git push -u origin feature/extension-scaffold
git push -u origin feature/settings-popup
git push -u origin feature/linkedin-content-script
git push -u origin feature/comment-generation

echo "Done. Repo: https://github.com/$(gh api user -q .login)/${REPO_NAME}"
