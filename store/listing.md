# Chrome Web Store listing

Everything needed for the Developer Dashboard submission. Assets are in `store/assets/`,
the upload package is built into `dist/` (git-ignored).

## Package
Build the zip after any change (from the repo root, Git Bash):

```bash
python -c "import zipfile; z=zipfile.ZipFile('dist/webtoons-dark-mode-1.0.0.zip','w',zipfile.ZIP_DEFLATED); [z.write(f) for f in ['manifest.json','dark.js','dark.css','icons/icon16.png','icons/icon48.png','icons/icon128.png']]; z.close()"
```

The version in the file name follows `manifest.json`; the store rejects a re-upload with a
version that is already published.

## Store listing tab

| Field | Value |
| --- | --- |
| Name | Webtoons Dark Mode |
| Summary (132 chars max) | Dark mode for the webtoons.com desktop site. Comic images are left untouched. |
| Category | Functionality & UI (or Accessibility) |
| Language | English |
| Store icon | from the package, `icons/icon128.png` |
| Screenshots (1280x800) | `store/assets/screenshot-1-viewer.png` … `screenshot-4-genres.png` |
| Small promo tile (440x280) | `store/assets/promo-small-440x280.png` |
| Marquee promo (1400x560) | not provided - only needed for featured placement |

### Description - what it has to cover (Vatra writes the text)
- What it does: webtoons.com goes dark - background, menus, series pages, episode list, comments.
- The one thing that sets it apart: comic images are never touched, so the art keeps its real
  colors. Panels drawn on white stay white, because that is the drawing itself.
- How: it reads the site's own stylesheets and recalculates their colors, instead of using a
  fixed list of selectors, so it survives most site changes.
- Works on the whole site, including the comments section.
- No accounts, no settings, no data collection; access only to webtoons.com.
- To turn it off: disable the extension at `chrome://extensions`.
- Closing line: not affiliated with WEBTOON / NAVER WEBTOON.

## Privacy practices tab

- **Single purpose:** Restyles the webtoons.com website with a dark color scheme.
- **Host permission justification (`*://*.webtoons.com/*`):** The extension needs to read the
  stylesheets of webtoons.com pages and insert its own recolored stylesheet into them. This is
  the only way to restyle the site, and it is limited to webtoons.com.
- **Remote code:** No. All code is in the package; nothing is loaded or executed from a server.
  (The extension does fetch one CSS file that the site itself already loads - CSS is data,
  not executable code.)
- **Data usage:** none of the categories are collected. Certify all three statements: data is
  not sold to third parties, not used for unrelated purposes, not used for creditworthiness.
- **Privacy policy URL:** https://vatroslav.github.io/privacy-policies/webtoons-dark-mode/

## Distribution
- Visibility: Public
- Regions: all
- Price: free
