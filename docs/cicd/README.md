# CI/CD Infrastructure - Frontend

## Overview

The Refactor Platform frontend uses GitHub Actions for continuous integration, release builds, and PR preview deployments. The CI/CD infrastructure is shared with the backend repository.

**Quick Stats:**
- **5 GitHub Actions Workflows** (CI, Release, Deploy, PR Preview x2)
- **Docker-based Deployment** to GitHub Container Registry (GHCR)
- **Production Platform:** DigitalOcean (accessed via Tailscale VPN)
- **Preview Platform:** Raspberry Pi 5 (ARM64, coordinated with backend)

---

## Workflows

### 1. Branch CI Pipeline
**File:** `.github/workflows/build_and_push_nonproduction_images.yml`
**Triggers:** Push to main, Pull requests to main

Runs linting, testing, and builds Docker images for non-production branches.

### 2. Production Release Builds
**File:** `.github/workflows/build_and_push_production_images.yml`
**Triggers:** GitHub releases (type: released), Manual dispatch

Builds multi-architecture stable images for production deployment.

### 3. Production Deployment
**File:** `.github/workflows/deploy_to_do.yml`
**Triggers:** Manual dispatch only

Deploys to DigitalOcean via Tailscale VPN (coordinated with backend deployment).

### 4. Frontend PR Preview
**File:** `.github/workflows/pr-preview-frontend.yml` (on branch 225)
**Triggers:** Pull request opened/synchronize/reopened (frontend changes)

Calls the backend repository's reusable workflow to deploy PR preview environments.

**Parameters:**
- `repo_type: 'frontend'`
- `pr_number`: PR number
- `branch_name`: Frontend PR branch
- `backend_branch`: 'main' (or temporary override)

### 5. Frontend PR Cleanup
**File:** `.github/workflows/cleanup-pr-preview-frontend.yml` (on branch 225)
**Triggers:** Pull request closed/merged

Calls the backend repository's reusable cleanup workflow.

---

## PR Preview Environments

Frontend PRs trigger the same preview environment infrastructure as backend PRs. The workflows call reusable workflows in the backend repository:

- **Deployment:** `refactor-group/refactor-platform-rs/.github/workflows/ci-deploy-pr-preview.yml`
- **Cleanup:** `refactor-group/refactor-platform-rs/.github/workflows/cleanup-pr-preview.yml`

This ensures parity between frontend and backend PR previews - both create isolated full-stack environments with unique ports.

**Access:** Requires Tailscale VPN connection. Preview URLs are posted as PR comments.

---

## Comprehensive Documentation

For complete CI/CD infrastructure documentation, including:
- Detailed workflow specifications
- Docker infrastructure guides
- Database migration workflows
- Security and secrets management
- Troubleshooting guides
- Gap analysis and future improvements

See: **[Backend Repository CI/CD Docs](https://github.com/refactor-group/refactor-platform-rs/tree/main/docs/cicd)**

The backend repository contains the authoritative documentation for the shared CI/CD infrastructure, including the reusable workflows that both repositories use for PR preview deployments.
