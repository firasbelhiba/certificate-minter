# 🎓 Course Certificates on Hedera

Issue **end-of-course certificates as NFTs** on the **Hedera** network. Students register their wallet, the instructor mints a certificate for the whole class in one click, and each student claims theirs into their own wallet. Built with **Next.js 14**, the official **@hashgraph/sdk**, **Upstash Redis**, and **Pinata/IPFS**.

> Runs on Hedera **testnet** by default (free, no real money).

---

## Table of contents
1. [What it does](#1-what-it-does)
2. [Core concepts (Hedera & NFTs)](#2-core-concepts-hedera--nfts)
3. [Architecture at a glance](#3-architecture-at-a-glance)
4. [The full workflow — step by step, in order](#4-the-full-workflow--step-by-step-in-order)
5. [Project structure — every file explained](#5-project-structure--every-file-explained)
6. [Request flow — what calls what](#6-request-flow--what-calls-what)
7. [Data model](#7-data-model)
8. [Environment variables](#8-environment-variables)
9. [Run locally](#9-run-locally)
10. [Deploy to Vercel](#10-deploy-to-vercel)
11. [FAQ / troubleshooting](#11-faq--troubleshooting)

---

## 1. What it does

- **Student page (`/`)** — a student enters their name + Hedera account ID (or connects HashPack) and registers.
- **Instructor page (`/admin`)** — password-protected. The instructor sets a course name and clicks **Mint all**; one certificate NFT is minted per student into the treasury (a live progress bar shows each one). There's also a **Clear all students** button to start fresh.
- **Claim** — each student associates the token with their account, then clicks **Claim**; the certificate NFT is transferred from the treasury into their wallet.

Every certificate is a personalized SVG diploma (student name, course, issuer, date) whose image + metadata live on IPFS (or are served by the app), and it's publicly verifiable on HashScan.

---

## 2. Core concepts (Hedera & NFTs)

| Concept | Explanation |
|---|---|
| **NFT** | A **non-fungible** (unique) token — perfect for a tamper-proof certificate. |
| **HTS** | *Hedera Token Service* — Hedera's native way to create tokens/NFTs (no smart contract needed). |
| **Token = collection** | The token `0.0.9394237` **is** the collection ("the album"). |
| **Serial number = one NFT** | Each certificate is `0.0.9394237/N` ("one photo in the album"). An NFT can never exist without a collection. |
| **Treasury** | The account where NFTs are first minted — here, the instructor's account. |
| **Association** | ⚠️ On Hedera, an account must **associate** a token *before* it can receive it (anti-spam). This is why students associate before claiming. |
| **HIP-412** | The NFT metadata standard. On-chain we store a short **pointer** (a URL or `ipfs://CID`) to a JSON file with the details. |
| **IPFS** | Decentralized storage (via Pinata) for the image + metadata JSON. Optional — the app can serve them itself. |
| **Mirror node** | Hedera's read-only API to query on-chain state (balances, NFTs, associations). |

---

## 3. Architecture at a glance

```
                         ┌──────────────────────────────────────┐
      Browser            │            Next.js (Vercel)          │        Hedera
 ┌───────────────┐       │  ┌────────────┐   ┌───────────────┐  │   ┌──────────────┐
 │ Student page  │──────▶│  │ API routes │──▶│ lib/ (logic)  │──┼──▶│ HTS (mint /  │
 │  (app/page)   │       │  │ app/api/…  │   │ hedera, mint, │  │   │  transfer)   │
 ├───────────────┤       │  └────────────┘   │ db, ipfs…     │  │   └──────────────┘
 │ Admin page    │──────▶│         │         └───────┬───────┘  │   ┌──────────────┐
 │ (app/admin)   │       │         │                 │          │──▶│ Mirror node  │
 └───────────────┘       │         ▼                 ▼          │   │ (read state) │
                         │   ┌────────────┐   ┌───────────────┐ │   └──────────────┘
                         │   │ Upstash    │   │ Pinata / IPFS │ │
                         │   │ Redis (DB) │   │ (image+json)  │ │
                         │   └────────────┘   └───────────────┘ │
                         └──────────────────────────────────────┘
```

- **Frontend** (React pages) call **API routes** (server-side).
- **API routes** use the **`lib/`** helpers for all the real logic.
- **`lib/`** talks to **Hedera** (mint/transfer), the **database** (student list), and **IPFS** (images).

---

## 4. The full workflow — step by step, in order

### One-time setup (already done)
0. **Create the collection**: [`POST /api/create-token`](app/api/create-token/route.js) → `TokenCreateTransaction` creates the NFT token `0.0.9394237` (treasury = instructor). Its ID goes into `HEDERA_TOKEN_ID`.

### Live flow
1. **Student registers** → [`app/page.js`](app/page.js) calls [`POST /api/register`](app/api/register/route.js)
   → validates the account ID → saves `{ name, accountId, status: "registered" }` in the DB ([`lib/db.js`](lib/db.js)).

2. **Instructor mints** → [`app/admin/page.js`](app/admin/page.js) clicks *Mint all* → calls [`POST /api/admin/mint-all`](app/api/admin/mint-all/route.js) in a loop (5 students per call):
   - For each student → [`lib/mint.js`](lib/mint.js) `mintCertificate()`:
     1. render the SVG diploma ([`lib/certificate.js`](lib/certificate.js))
     2. pin image + metadata to IPFS ([`lib/ipfs.js`](lib/ipfs.js)) **or** save metadata in the DB
     3. `TokenMintTransaction` → creates a new **serial** in the collection (owned by the **treasury**)
   - The student's status becomes `"minted"` and their `serial` is saved.
   - The progress bar fills as each batch returns.

3. **Student associates the token** → in their wallet (HashPack → *Associate token* `0.0.9394237`), or via WalletConnect in-app. This is the mandatory Hedera step.

4. **Student claims** → [`app/page.js`](app/page.js) clicks *Claim* → [`POST /api/claim`](app/api/claim/route.js):
   - checks association via the mirror node ([`lib/hedera.js`](lib/hedera.js) `isAssociated`)
   - if associated → `TransferTransaction` moves the NFT **treasury → student**
   - status becomes `"transferred"`.
   *(Alternatively the instructor can push to everyone associated via [`POST /api/admin/distribute`](app/api/admin/distribute/route.js).)*

5. **Verify** → the NFT is now in the student's wallet and publicly visible on **HashScan**. Its image/metadata resolve from IPFS or the app.

**Status lifecycle:** `registered → minted → transferred`

---

## 5. Project structure — every file explained

```
hedera-certificates/
├─ app/
│  ├─ layout.js                     Root layout (wraps every page, loads global CSS)
│  ├─ globals.css                   All the styling
│  ├─ page.js                       STUDENT page: register + claim
│  ├─ admin/
│  │  └─ page.js                    INSTRUCTOR dashboard: mint (progress bar), distribute, clear
│  └─ api/                          Server-side endpoints
│     ├─ config/route.js            Exposes non-secret config to the UI (never the private key)
│     ├─ register/route.js          Saves a student (validates account ID)
│     ├─ students/route.js          Public: count + names (for the student page)
│     ├─ status/route.js            A student's status by account ID
│     ├─ claim/route.js             Verifies association → transfers the NFT to the student
│     ├─ create-token/route.js      Creates the NFT collection (admin only)
│     ├─ metadata/[id]/route.js     Serves the HIP-412 metadata JSON (app-hosted mode)
│     ├─ certificate/[id]/route.js  Serves the diploma image (SVG) of a minted cert
│     ├─ certificate/preview/route.js  Live preview of a diploma (no minting)
│     └─ admin/
│        ├─ verify/route.js         Checks the admin password (login)
│        ├─ students/route.js       Full student list + counts (admin only)
│        ├─ mint-all/route.js       Mints certs in parallel batches (admin only)
│        ├─ distribute/route.js     Sends certs to all associated students (admin only)
│        └─ reset/route.js          Clears the database (admin only)
├─ lib/                             The real logic (reused by the API routes)
│  ├─ hedera.js                     Hedera client, key parsing, association check, base URL
│  ├─ mint.js                       mintCertificate(): the core minting logic
│  ├─ db.js                         Database: Upstash Redis (prod) or data/db.json (local)
│  ├─ ipfs.js                       Pin image + JSON to IPFS via Pinata
│  ├─ certificate.js                Generates the SVG diploma
│  ├─ auth.js                       Admin password check
│  └─ wallet.js                     HashPack / WalletConnect (browser only, optional)
├─ data/                            Local JSON database (dev only; git-ignored)
├─ scripts/
│  └─ make-test-account.mjs         Creates + associates a throwaway testnet account (testing)
├─ .env.local                       Secrets (git-ignored)
├─ .env.example                     Template of the env vars
└─ SCRIPT-PRESENTATION-FR.md        French teaching script (git-ignored, private)
```

### 📂 Clickable file index (click to open each file)

**Frontend**
- [app/layout.js](app/layout.js) — root layout
- [app/globals.css](app/globals.css) — styles
- [app/page.js](app/page.js) — **student page** (register + claim)
- [app/admin/page.js](app/admin/page.js) — **instructor dashboard**

**API routes** (`app/api/`)
- [config/route.js](app/api/config/route.js) — public config for the UI
- [register/route.js](app/api/register/route.js) — register a student
- [students/route.js](app/api/students/route.js) — public count + names
- [status/route.js](app/api/status/route.js) — a student's status
- [claim/route.js](app/api/claim/route.js) — **verify association → transfer NFT**
- [create-token/route.js](app/api/create-token/route.js) — create the collection
- [metadata/[id]/route.js](app/api/metadata/%5Bid%5D/route.js) — serve HIP-412 JSON
- [certificate/[id]/route.js](app/api/certificate/%5Bid%5D/route.js) — serve the diploma image
- [certificate/preview/route.js](app/api/certificate/preview/route.js) — live preview
- [admin/verify/route.js](app/api/admin/verify/route.js) — admin login
- [admin/students/route.js](app/api/admin/students/route.js) — full list + counts
- [admin/mint-all/route.js](app/api/admin/mint-all/route.js) — **batch mint**
- [admin/distribute/route.js](app/api/admin/distribute/route.js) — send to associated
- [admin/reset/route.js](app/api/admin/reset/route.js) — clear the database

**Logic** (`lib/`)
- [lib/hedera.js](lib/hedera.js) · [lib/mint.js](lib/mint.js) · [lib/db.js](lib/db.js) · [lib/ipfs.js](lib/ipfs.js) · [lib/certificate.js](lib/certificate.js) · [lib/auth.js](lib/auth.js) · [lib/wallet.js](lib/wallet.js)

**Other**
- [scripts/make-test-account.mjs](scripts/make-test-account.mjs) · [.env.example](.env.example)

### The `lib/` files in detail (click the name to open)
- **[hedera.js](lib/hedera.js)** — `getClient()` builds the Hedera client from the operator credentials; `parseKey()` accepts any key format; `getOperatorKey()` returns the signing key; `isAssociated()` asks the mirror node if an account associated the token; `getBaseUrl()` finds the app's public URL; `getHashScanBase()`/`getMirrorNodeBase()` return the right URLs per network.
- **[mint.js](lib/mint.js)** — `mintCertificate()` renders the SVG, stores metadata (IPFS or DB), runs `TokenMintTransaction`, and returns the new serial. **This is the heart of the app.**
- **[db.js](lib/db.js)** — a tiny data layer with two backends (Upstash Redis in prod, `data/db.json` locally). Functions: `upsertStudent`, `getStudent`, `listStudents`, `patchStudent`, `saveCert`, `getCert`, `clearAll`, `storageMode`.
- **[ipfs.js](lib/ipfs.js)** — `pinFile()` / `pinJSON()` upload to Pinata and return a CID; `gatewayUrl()` builds a viewable link; `ipfsEnabled()` toggles the whole IPFS path.
- **[certificate.js](lib/certificate.js)** — `renderCertificateSVG()` draws the diploma (borders, seal, name, course, footer).
- **[auth.js](lib/auth.js)** — `checkAdmin()` compares the `x-admin-password` header to `ADMIN_PASSWORD` (constant-time).
- **[wallet.js](lib/wallet.js)** — optional HashPack connection + token association signing (only active if a WalletConnect project id is set).

---

## 6. Request flow — what calls what

```
REGISTER
  page.js ──POST /api/register──▶ register/route.js ──▶ db.upsertStudent()

MINT (looped by the admin UI, 5 per call)
  admin/page.js ──POST /api/admin/mint-all──▶ mint-all/route.js
        │  auth.checkAdmin()
        │  for each student → mint.mintCertificate()
        │        ├─ certificate.renderCertificateSVG()
        │        ├─ ipfs.pinFile() + ipfs.pinJSON()  (or db.saveCert())
        │        └─ TokenMintTransaction (Hedera)
        └─ db.patchStudent(status:"minted", serial)

CLAIM
  page.js ──POST /api/claim──▶ claim/route.js
        ├─ db.getStudent()
        ├─ hedera.isAssociated()  ── mirror node
        ├─ TransferTransaction (treasury → student)   (Hedera)
        └─ db.patchStudent(status:"transferred")

IMAGE / METADATA (read by wallets & HashScan)
  wallet ──GET /api/metadata/[id]──▶ db.getCert()
  wallet ──GET /api/certificate/[id]──▶ db.getCert() → certificate.renderCertificateSVG()
```

---

## 7. Data model

Each **student** record (keyed by `accountId`):
```json
{
  "accountId": "0.0.12345",
  "name": "Ada Lovelace",
  "status": "registered | minted | transferred",
  "certId": "7eb25212a730d320",
  "serial": "12",
  "course": "Blockchain Masterclass"
}
```

Each **certificate** record (keyed by `certId`) is the HIP-412 metadata object (name, image, properties, attributes). Stored in the DB in app-hosted mode; on IPFS in IPFS mode.

---

## 8. Environment variables

See `.env.example`. Summary:

| Variable | Required | Purpose |
|---|---|---|
| `HEDERA_NETWORK` | ✅ | `testnet` or `mainnet` |
| `HEDERA_OPERATOR_ID` | ✅ | Instructor/treasury account (`0.0.…`) |
| `HEDERA_OPERATOR_KEY` | ✅ | Its private key (server-side only) |
| `HEDERA_TOKEN_ID` | ✅ | The certificate collection |
| `ADMIN_PASSWORD` | ✅ | Gate for `/admin` |
| `NEXT_PUBLIC_WC_PROJECT_ID` | optional | WalletConnect (HashPack connect) |
| `PINATA_JWT` / `PINATA_GATEWAY` | optional | Pin images/metadata to IPFS |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | prod | Database (auto-set by the Vercel Upstash integration) |
| `NEXT_PUBLIC_BASE_URL` | optional | Override the app's public URL (auto-detected otherwise) |

---

## 9. Run locally

```bash
npm install
npm run dev      # http://localhost:3000
```
- Locally the DB is `data/db.json` (no Redis needed).
- Default admin password is whatever you set in `.env.local`.
- Student page: `/` · Instructor: `/admin`.

---

## 10. Deploy to Vercel

1. Push this folder to a Git repo → import it into **Vercel**.
2. **Storage** tab → add the **Upstash Redis** integration (this injects the DB credentials). Without it, registrations fail (Vercel's filesystem is read-only).
3. **Settings → Environment Variables** → paste the values from section 8 (with a real `ADMIN_PASSWORD`).
4. **Redeploy** so the new env vars apply.
5. Open `/admin`, log in, and mint one test certificate to confirm.

---

## 11. FAQ / troubleshooting

- **"EROFS: read-only file system"** on register → the Upstash Redis DB isn't connected/redeployed. See section 10, step 2.
- **Image shows a spinner in the wallet** → freshly-pinned IPFS content takes a few minutes to propagate. Delete `PINATA_JWT` to serve images instantly from the app instead.
- **"Send to associated" says "Sent 0"** → none of the *registered* accounts have associated the token yet. The account that associates must be the same account that registered.
- **Nothing appears in the wallet after mint** → minting only creates the NFT in the **treasury**. The student must **associate + claim** to receive it.
- **Collection folder has a blank cover in HashPack** → cosmetic; that's a collection-level image we don't set. The individual NFTs each render their own image.

---

Built for a Hedera testnet showcase. On-chain, tamper-proof, and verifiable on [HashScan](https://hashscan.io/testnet).
