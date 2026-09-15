# Publishing policy

This repository is **public** as of 2026-09-15. This file records what must
never be committed to it, and what was done to make publishing safe.

---

## 1. `articles/` must never be committed

During the prior-art phase this repository carried an `articles/` directory of
45 third-party files — 31 research papers, 11 patents, a manifest and two
archived web pages. The papers were publisher and author copies, including a
Springer chapter bought for USD 29.95 and two IEEE papers. Publishing them
would redistribute paywalled work.

**Status: resolved.** The directory was removed and the history rebuilt before
the first public push, so no version of this repository has ever contained
them. Verify with:

```bash
git rev-list --objects --all | awk '{print $2}' | grep '^articles/'   # empty
```

Deleting such files in a later commit is **not** sufficient on its own — Git
keeps every committed version, so the blobs stay reachable to anyone who
clones. Removing them properly means rewriting history with `git filter-repo`
(or rebuilding the commit) and force-pushing. Do it before the files are ever
pushed to a public remote; afterwards, assume they were cloned or indexed.

### What replaced them

Nothing of value was lost. `README.md` now carries a resolvable DOI, or a
direct link where the publisher or author offers a free copy, for every
reference. Patents link to Google Patents.

## 2. Other checks

- [x] `node_modules/` is not tracked. (Untracked 2026-09-15.)
- [x] No API tokens or hardcoded local paths in `src/` or `tools/`.
      (Scanned 2026-09-15.)

## 3. Automated guard

`.github/workflows/pre-publish-guard.yml` fails the build if this repository is
public while non-redistributable files under `articles/` are either tracked in
the tree or reachable anywhere in history. It is what stops the directory from
being reintroduced.
