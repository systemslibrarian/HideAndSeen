# Pre-publish checklist

**Run this before flipping `systemslibrarian/HideAndSeen` to public.**

The repository is private today. `DISCLOSURE.md` records that going public is a
deliberate act, and the disclosure ledger already has a dated row for it. This
file covers the one thing that is *not* meant to go out with it.

---

## 1. `articles/` must not ship

**Status: deleted from the working tree, still present in history.**

`articles/` held 45 files — 31 third-party papers plus 11 patents, a manifest
and two archived web pages. The whole directory was removed from the tree, but
the blobs remain reachable in the initial commit `ca30936`. They are fine in a
private repo — that is a personal research copy. They are not fine in a public
one: publishing them redistributes paywalled work, including a Springer chapter
bought for USD 29.95 and two IEEE papers.

**GitHub visibility is repository-level. There is no private folder inside a
public repo**, and no setting or `.gitattributes` trick that creates one. The
Pages workflow publishes only `docs/`, so Pages itself will not serve these —
but anyone browsing the public repo on github.com would get all of them.

### What has to happen

Deleting `articles/` in a new commit is **not sufficient.** The blobs stay
reachable in history. Removing them properly means rewriting history:

```bash
# inspect first — confirms the blobs are still reachable
git log --oneline --all -- articles/
git rev-list --objects --all | grep articles/ | head

# strip the directory from all history (git-filter-repo, not filter-branch)
pip install git-filter-repo
git filter-repo --path articles/ --invert-paths

# then force-push, and confirm the blobs are gone
git push --force origin main
```

Do this **before** the first public push, not after. Once the repo has been
public, assume the content was cloned or indexed and treat the rewrite as
damage limitation rather than prevention.

### What was removed anyway

These four groups were redistributable and could have stayed. They were dropped
with the rest, so the rewrite can strip `articles/` wholesale with no sorting:

- `articles/patents/` — 11 patent PDFs. Government publications, not under
  copyright. Now linked to Google Patents from `README.md` instead.
- `articles/MANIFEST.md` — written here, carrying a direct source link for every
  reference. Its links were folded into `README.md`, which now gives a DOI or a
  free-copy link for every entry.
- `articles/web/libqrencode-issue-220.md` — an archived public GitHub thread.
  `README.md` links the live issue instead.
- `articles/web/reed-solomon-codes-for-coders.md` — Wikiversity, CC BY-SA 4.0.

### What must not

Everything else under `articles/`, including all of `articles/methods/`. Three carry an explicit CC BY 4.0 statement
in the document itself and are genuinely redistributable —
`ieee-access-2020-stego-encrypted-msgs-qr.pdf`,
`koptyra-2024-multisecret.pdf`, `lin-chen-2017-high-payload-secret-hiding.pdf`
— and a few more are open access without an in-document licence line. The rest
are publisher copies or author copies under publisher copyright. Sorting the
genuinely-free ones from the rest is more work than re-downloading them from
the links in `MANIFEST.md`, so the default is: none of them ship.

## 2. Other checks

- [ ] `DISCLOSURE.md` disclosure-ledger date matches the actual publish date.
- [ ] Employment check noted in `DISCLOSURE.md` (LCPL / Leon County IP
      assignment) is resolved.
- [x] `node_modules/` is not tracked. (Untracked 2026-09-15.)
- [ ] No API tokens or local paths in `src/` or `tools/` — `encoders.py` hardcodes
      `NODE_DIR = /home/claude/nodeqr`.

## 3. Automated guard

`.github/workflows/pre-publish-guard.yml` fails the build if the repository is
public while non-redistributable files under `articles/` are either **tracked in
the tree or still reachable in history**. The history check matters now that the
directory has been deleted but not yet stripped: a tracked-files-only check
would pass and give false reassurance. It is still a backstop, not a substitute
— it can only fire *after* the repo is already public.
