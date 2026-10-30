# Start Hucxter Locally: the routine after every update

**Who:** Founder, QA, anyone reviewing a Claude Code build on a Mac. **Applies from:** Brief 02
onward. From Brief 02 on, the storefront reads categories and ZIP areas from the local database, so
the database must be running and loaded before the app.

Do the same routine every time, in this order. Each step tells you what "good" looks like.

---

## A. One-time setup (already done on Adbyrds-MBP)
Node 24 · pnpm 12 · Docker Desktop · Supabase CLI · Claude Code · Chrome. To check, run
`node --version && pnpm --version && docker --version && supabase --version`; each should print a
version.

---

## B. Every time you start (or after Claude Code finishes a brief)

### 1. Start Docker Desktop
Open Docker Desktop and wait until it says **Engine running**.

**Good:** `docker info` prints details, not "Cannot connect to the Docker daemon."

### 2. Go to the project and pick the code you want to see
```sh
cd ~/path/to/hucxter
git status                    # must say "nothing to commit"; if not, see Troubleshooting
git fetch origin
```
- **To see what's merged:** `git checkout main && git pull`
- **To review an open PR before merging** (e.g., Brief 02 = PR #5):
  ```sh
  git checkout brief-02-storefront && git pull
  ```
  The branch name is at the top of the PR on GitHub ("wants to merge **brief-02-storefront** into
  main").

**Good:** `git log --oneline -1` shows the latest commit from the PR or `main`.

### 3. Install any new packages
```sh
pnpm install
```
**Good:** ends with "Done". It's quick when nothing changed.

### 4. Start the local database and load the latest data
```sh
supabase start
supabase db reset
```
- `supabase start` is safe to run when it's already running ("supabase start is already
  running").
- `supabase db reset` **rebuilds the local database** from the migrations and seed (categories,
  ZIP areas). Run it after every pull, because new briefs add tables and data.
- Local data is wiped. That's expected in Phase I; nothing real lives locally.

**Good:** ends with "Finished supabase db reset".

### 5. Check your settings file (first time on a machine, or when a brief adds a variable)
The app reads **only** `apps/web/.env.local` (inside `apps/web`, the name begins with a dot, and
there's no `.txt`).

Create it from the template if it doesn't exist:
```sh
cp -n apps/web/.env.example apps/web/.env.local
open -a "Visual Studio Code" apps/web/.env.local
```
Get the two Supabase values:
```sh
supabase status
```
Fill the file so it looks like this:
```
APP_ENV=local
APP_ORIGIN=http://localhost:3000
GIT_COMMIT_SHA=
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_PUBLISHABLE_KEY=sb_publishable_…   ← the "Publishable" value from `supabase status`
DEFAULT_AREA_ZIP=75009
```
Rules:
- Use the **Publishable** key only. **Never** the "Secret" key.
- Never use your cloud project ID (`zyjxmsssgqzgukokyyob`) here; it isn't a key.
- These local keys are the Supabase CLI's local-only defaults. They're fine on your machine, but
  never commit the file. Git already ignores it.
- When a new brief says it adds a variable, compare with
  `diff apps/web/.env.example apps/web/.env.local` and add what's missing.

**Good:**
```sh
ls -la apps/web/.env.local
```
shows the file, and
```sh
grep -c "^SUPABASE_" apps/web/.env.local
```
prints `2`.

### 6. Start the app
```sh
pnpm dev
```
Open **http://localhost:3000** in Chrome.

**Good:** "✓ Ready" in Terminal and the Hucxter storefront in Chrome. If you changed
`.env.local` while it was running, stop it with **Ctrl+C** and run `pnpm dev` again.

### 7. Review the build (what to check after each brief)
- Click through the routes listed in the PR description and README.
- Try it as a **guest**: actions should open the sign-in sheet.
- Use the keyboard only for one flow: Tab, Enter, Esc.
- Toggle macOS dark mode (System Settings → Appearance) and reload.
- Optional full check (takes several minutes): `pnpm test:e2e`.
- Then comment on or approve the PR on GitHub, or send it to the Chair for review.

### 8. When you're done
Press **Ctrl+C** in the `pnpm dev` window. `supabase stop` frees memory; the next `supabase start`
brings the database back. Then `git checkout main` so you don't build on a PR branch by
accident.

---

## C. The 30-second version (after the first time)
```sh
cd ~/path/to/hucxter
git fetch origin && git checkout <branch-or-main> && git pull
pnpm install
supabase start && supabase db reset
pnpm dev            # → http://localhost:3000
```

---

## D. Troubleshooting

| You see | Cause | Fix |
|---|---|---|
| `SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set` | `apps/web/.env.local` missing, misnamed (e.g. `.env.local.txt`, or saved at the repo root), or missing values | Step 5. Check with `ls -la apps/web/` and look for exactly `.env.local`. Then restart `pnpm dev` |
| App loads but shows errors about categories, `401`/`Invalid API key` | Wrong key (cloud project ID or secret key) in `SUPABASE_PUBLISHABLE_KEY` | Paste the **Publishable** value from `supabase status`; restart `pnpm dev` |
| Categories missing or empty, `relation "categories" does not exist` | Database not rebuilt after pulling | `supabase db reset` |
| `Cannot connect to the Docker daemon` | Docker Desktop not running | Open Docker Desktop, wait for Engine running, then `supabase start` |
| `supabase start` lists **"Stopped services"** (studio, storage, realtime…) | A test run started the smaller CI set of services | Fine for now. For the full set (including the Studio web UI): `supabase stop && supabase start` |
| `port 3000 is in use` / Next picks 3001 | Another `pnpm dev` is still running | Close the other Terminal tab, or `lsof -ti:3000 \| xargs kill` |
| `git checkout` refuses: "local changes would be overwritten" | Files edited or unzipped in the folder | `git status` to see them. If they're not yours to keep: `git stash -u`. Ask before deleting anything |
| `/dev/fd/13:18: command not found: compdef` when opening Terminal | A shell-completion line in `~/.zshrc` runs before zsh's completion system loads | Harmless. To silence it, add `autoload -Uz compinit && compinit` as the **first line** of `~/.zshrc`, then open a new Terminal |
| `pnpm install` fails with "minimum release age" | A dependency version is too new for the supply-chain check | Don't bypass it; tell Claude Code to pin the previous version |

---

## E. Rules that never change
- Never commit `.env.local` or paste the **Secret** key anywhere.
- Never run `supabase link` or `supabase db push` unless the Chair's brief says to; those touch the
  cloud project.
- Review PR branches locally **before** merging to `main`.
