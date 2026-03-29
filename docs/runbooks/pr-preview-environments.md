# PR Preview Environments - Developer Guide

This guide explains how to use PR preview environments for the Refactor Platform.

## 🚀 Quick Start

**Deploy a preview environment manually via workflow dispatch!**

Preview environments are deployed on-demand — they are not created automatically when you open a PR.

### How to Deploy a Preview

1. ✅ **Open a PR** in `refactor-platform-rs` or `refactor-platform-fe`
2. ✅ **Go to Actions** → "Deploy PR Preview (Manual Select)" → Run workflow
3. ✅ **Select commits** from dropdowns (or use SHA override fields)
4. ✅ **Wait for deployment** (~5-10 min for first build)
5. ✅ **Check PR comment** for access URLs
6. ✅ **Auto-cleanup** when PR closes/merges

### Access Your Preview

After deployment completes, check the PR comment for your URLs:

```
🚀 PR Preview Environment Deployed!

Frontend:     http://neo.rove-barbel.ts.net/pr-201/
Backend API:  http://neo.rove-barbel.ts.net/pr-201/api/
Health Check: http://neo.rove-barbel.ts.net/pr-201/health
Base Path:    /pr-201/

Access Method: NGINX path-based routing (no direct port access)
```

**Requirements:**
- 🔐 Must be connected to Tailscale VPN

---

## 📖 Full Documentation

For complete documentation including troubleshooting, advanced usage, and monitoring:

👉 **See: [Backend Repo PR Preview Runbook](https://github.com/refactor-group/refactor-platform-rs/blob/main/docs/cicd/pr-preview-environments.md)**

The complete runbook covers:
- Path-based routing architecture
- NGINX configuration
- Network isolation and security
- Testing & debugging
- Manual cleanup procedures
- Advanced configuration options
- Monitoring and troubleshooting

---

## 🎯 Quick Reference

### URL Pattern

All PRs use path-based routing through NGINX:

| Service | URL Pattern | Example (PR #201) |
|---------|------------|-------------------|
| Frontend | `/pr-<NUM>/` | `http://neo.rove-barbel.ts.net/pr-201/` |
| Backend API | `/pr-<NUM>/api/` | `http://neo.rove-barbel.ts.net/pr-201/api/` |
| Health Check | `/pr-<NUM>/health` | `http://neo.rove-barbel.ts.net/pr-201/health` |

### Common Commands

**Health check:**
```bash
curl http://neo.rove-barbel.ts.net/pr-201/health
```

**API test:**
```bash
curl http://neo.rove-barbel.ts.net/pr-201/api/v1/users
```

**View logs:**
```bash
ssh user@neo.rove-barbel.ts.net
docker logs pr-201-frontend-1 -f
docker logs pr-201-backend-1 -f
```

**Check status:**
```bash
ssh user@neo.rove-barbel.ts.net
docker compose -p pr-201 ps
```

---

## 🔧 How Frontend PRs Work

When you deploy a frontend PR preview:
1. **Trigger:** Go to Actions → "Deploy PR Preview (Manual Select)" → Run workflow
2. **Frontend:** Builds from your selected commit 📦
3. **Backend:** Builds from your selected commit (or uses main-arm64 if main commit selected)
4. **Deploy:** Full stack with your chosen commit combination
5. **NGINX Routes:** Automatically routes `/pr-<NUM>/` to your containers

**No secrets needed in frontend repo!** All configuration is managed centrally in the backend repo's `pr-preview` environment.

**Frontend Build Configuration:**
- Backend API endpoint configured at build time
- Uses path-based routing: `pr-<NUM>/api/`
- All API calls go through NGINX (no direct container access)

---

## 🏗️ Architecture

```
Browser (Tailscale VPN)
        ↓
NGINX (neo.rove-barbel.ts.net:80)
  ├─ /pr-201/ → pr-201-frontend-1:3000
  ├─ /pr-201/api/ → pr-201-backend-1:3000
  └─ /pr-202/ → pr-202-frontend-1:3000
        ↓
Docker Containers (No Host Ports)
  ├─ pr-201-frontend-1 (port 3000, internal)
  ├─ pr-201-backend-1 (port 3000, internal)
  └─ pr-201-postgres-1 (port 5432, internal only)
```

**Security Features:**
- ✅ Single ingress point (NGINX only)
- ✅ No direct container port access
- ✅ Postgres never exposed externally
- ✅ Network isolation between PRs

---

## 🐛 Troubleshooting

**Deployment failed?**
- Check workflow logs: PR → "Checks" tab → View failed workflow
- Common: Lint errors, test failures, build errors
- Verify frontend build args include correct NGINX path

**Can't access preview?**
- Verify Tailscale: `tailscale status`
- Check correct path from PR comment (must start with `/pr-<NUM>/`)
- Ensure workflow succeeded
- Test NGINX: `curl http://neo.rove-barbel.ts.net/pr-201/health`

**502 Bad Gateway?**
- Containers may not be running
- Check: `ssh user@neo.rove-barbel.ts.net && docker ps --filter 'name=pr-201'`
- View logs: `docker logs pr-201-frontend-1 --tail 50`

**Frontend not loading?**
- Verify frontend container is running
- Check frontend logs for build/runtime errors
- Ensure frontend env vars are correctly set (NEXT_PUBLIC_BACKEND_SERVICE_*)

**API calls failing?**
- Frontend makes API calls to `/pr-<NUM>/api/` through NGINX
- Check browser network tab for actual request URLs
- Verify backend container is healthy: `curl http://neo.rove-barbel.ts.net/pr-201/health`

**Need help?**
- Check full runbook (linked above)
- Ask in #engineering Slack
- Open an issue

---

**Happy Testing! 🚀**
