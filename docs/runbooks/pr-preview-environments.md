# PR Preview Environments - Developer Guide

This guide explains how to use automatic PR preview environments for the Refactor Platform.

## 🚀 Quick Start

**Open a PR = Get a live preview environment automatically!**

Every PR in `refactor-platform-rs` (backend) or `refactor-platform-fe` (frontend) triggers an automatic deployment of a full-stack preview environment.

### What Happens When You Open a PR

1. ✅ **Automatic deployment** starts (~5-10 min for first build)
2. ✅ **Full stack** deployed: Postgres + Backend + Frontend  
3. ✅ **Unique ports** assigned based on PR number
4. ✅ **PR comment** posted with access URLs
5. ✅ **Auto-cleanup** when PR closes/merges

### Access Your Preview

After deployment completes, check the PR comment for your URLs:

```
🚀 PR Preview Environment Deployed!

Frontend: http://rpi5-hostname:3042
Backend:  http://rpi5-hostname:4042  
Health:   http://rpi5-hostname:4042/health

Ports: Frontend: 3042 | Backend: 4042 | Postgres: 5474
```

**Requirements:**
- 🔐 Must be connected to Tailscale VPN

---

## 📖 Full Documentation

For complete documentation including troubleshooting, advanced usage, and monitoring:

👉 **See: [Backend Repo PR Preview Runbook](https://github.com/refactor-group/refactor-platform-rs/blob/main/docs/runbooks/pr-preview-environments.md)**

The complete runbook covers:
- Port allocation formula
- Deployment architecture
- Testing & debugging
- Manual cleanup procedures
- Advanced configuration options
- Security considerations

---

## 🎯 Quick Reference

### Port Formula

| Service | Formula | Example (PR #42) |
|---------|---------|------------------|
| Frontend | 3000 + PR# | 3042 |
| Backend | 4000 + PR# | 4042 |
| Postgres | 5432 + PR# | 5474 |

### Common Commands

**Health check:**
```bash
curl http://rpi5-hostname:4042/health
```

**View logs:**
```bash
ssh user@rpi5-hostname
docker logs pr-42-frontend-1 -f
docker logs pr-42-backend-1 -f
```

**Check status:**
```bash
ssh user@rpi5-hostname
docker compose -p pr-42 ps
```

---

## 🔧 How Frontend PRs Work

When you open a frontend PR:
1. **Frontend:** Builds from your PR branch 📦
2. **Backend:** Uses main-arm64 image (or builds if missing)
3. **Deploy:** Full stack with your frontend changes

**No secrets needed in frontend repo!** All configuration is managed centrally in the backend repo's `pr-preview` environment.

---

## 🐛 Troubleshooting

**Deployment failed?**
- Check workflow logs: PR → "Checks" tab → View failed workflow
- Common: Lint errors, test failures, build errors

**Can't access preview?**
- Verify Tailscale: `tailscale status`
- Check correct port from PR comment
- Ensure workflow succeeded

**Need help?**
- Check full runbook (linked above)
- Ask in #engineering Slack
- Open an issue

---

**Happy Testing! 🚀**
