#!/bin/sh
# Git credential helper — reads GITHUB_TOKEN from environment.
# Configured via: git config credential.helper 'scripts/git-credential-helper.sh'
# The token is stored as a Replit Secret (GITHUB_TOKEN) so it survives container rebuilds.
if [ -z "$GITHUB_TOKEN" ]; then
  echo "error: GITHUB_TOKEN secret is not set" >&2
  exit 1
fi
echo "username=x-token"
echo "password=$GITHUB_TOKEN"
