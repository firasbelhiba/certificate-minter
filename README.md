# 🎓 Course Certificates on Hedera

Students register their wallet, the instructor mints end-of-course certificate
NFTs for everyone, and each student claims theirs into their own wallet — all on
**Hedera** (testnet). Built with Next.js 14.

## The workflow

1. **Student** (`/`) — connects HashPack (or pastes their account ID) + name → registers.
2. **Instructor** (`/admin`, password-protected) — logs in, sees all registrations, sets a course name, clicks **Mint all**. One certificate NFT per student is minted into the treasury.
3. **Student** (`/`) — clicks **Associate & Claim**: their wallet signs the token association, then the backend transfers their certificate NFT to them.

> On Hedera an account must *associate* a token before it can receive it — that's built into the claim flow. The transfer (treasury → student) is signed by your operator key and only succeeds after association.

## Architecture

| Path | Purpose |
|------|---------|
| `app/page.js` | Student page: register + claim |
| `app/admin/page.js` | Instructor dashboard: mint all + distribute |
| `app/api/register` | Save a student (name + account) |
| `app/api/admin/mint-all` | Batch-mint certificates (parallel, resumable) |
| `app/api/claim` | Associate check + transfer NFT to student |
| `app/api/admin/distribute` | Backup: push to all associated students |
| `app/api/metadata/[id]` · `certificate/[id]` | HIP-412 JSON + diploma image |
| `lib/db.js` | Data store — `data/db.json` locally, Upstash Redis in prod |
| `lib/mint.js` | Mints one certificate (IPFS or app-hosted metadata) |
| `lib/wallet.js` | HashPack via Hedera WalletConnect |
| `lib/certificate.js` | Generates the SVG diploma |

## Environment variables

See `.env.example`. Key ones:

| Var | Required | Notes |
|-----|----------|-------|
| `HEDERA_OPERATOR_ID` / `HEDERA_OPERATOR_KEY` | ✅ | Your testnet operator (treasury). |
| `HEDERA_TOKEN_ID` | ✅ | The certificate collection token. |
| `ADMIN_PASSWORD` | ✅ | Gate for the `/admin` section. Change it! |
| `NEXT_PUBLIC_WC_PROJECT_ID` | for wallet | Reown/WalletConnect project id (free, cloud.reown.com). |
| `NEXT_PUBLIC_BASE_URL` | prod | Set to your deployed URL so on-chain metadata resolves. |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | prod | Auto-set by Vercel's Upstash Redis integration. |
| `PINATA_JWT` | optional | Pin images to IPFS instead of serving from the app. |

## Run locally

```bash
npm install
npm run dev            # http://localhost:3000
```

Locally the student list is stored in `data/db.json` (gitignored). Admin password defaults to `changeme`.

## Deploy to Vercel

1. Push this folder to a Git repo and import it into Vercel.
2. **Storage:** in the Vercel project → Storage → add a **Redis (Upstash)** integration. It injects `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` automatically.
3. **Environment variables** (Project → Settings → Environment Variables):
   - `HEDERA_NETWORK=testnet`
   - `HEDERA_OPERATOR_ID`, `HEDERA_OPERATOR_KEY`, `HEDERA_TOKEN_ID`
   - `ADMIN_PASSWORD` (a strong one)
   - `NEXT_PUBLIC_WC_PROJECT_ID` (from cloud.reown.com)
   - `NEXT_PUBLIC_BASE_URL=https://<your-app>.vercel.app`  ← set after first deploy, then redeploy
4. Redeploy. Share the URL with students; keep `/admin` to yourself.

## Notes

- **Images show in wallets/HashScan** because the app serves them from its public Vercel URL (or IPFS if `PINATA_JWT` is set). This is why `NEXT_PUBLIC_BASE_URL` must be your real domain.
- `mint-all` and `distribute` process in batches of 5 and the UI loops until done, so they never hit serverless timeouts even for large classes.
- `scripts/make-test-account.mjs` creates + associates a throwaway testnet account for testing the claim flow.
