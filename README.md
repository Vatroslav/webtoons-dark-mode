# Webtoons Dark Mode

Chrome extension that gives webtoons.com (desktop site) a dark theme. Comic images are never touched, so the art keeps its exact colors.

Loaded as an unpacked extension, it has no `update_url`, so it **never auto-updates**. The code only changes when you change it.

## How it works
- `dark.js` reads the site's own stylesheets and adds a copy of every color rule with the color remapped: light backgrounds become dark, dark text becomes light, things that are already dark stay dark. Because it works from the site's CSS instead of a fixed list of selectors, new pages and redesigns are mostly covered without changes.
- The comments section loads its stylesheet from `ssl.pstatic.net` and uses CSS variables. That file is fetched directly (the server allows it via CORS) and the variables are resolved to their colors.
- `dark.css` sets the dark page background before the page renders (no white flash) and fixes a few elements that are drawn with images instead of CSS colors (rank digits, "back to top" button, search icon, "Recently viewed" panel).

Comic panels with white backgrounds stay white - that is the art itself.

## Permissions
None besides running on `*.webtoons.com`. No background script, no storage, no data collection. The only network request it makes is re-reading the comments stylesheet the page already loads.

## Installation
It is not on the Chrome Web Store, so it is installed unpacked:

1. Download `webtoons-dark-mode-1.0.0.zip` from [Releases](https://github.com/Vatroslav/webtoons-dark-mode/releases) and unzip it into a folder you will keep (Chrome loads it from there every time)
2. Open `chrome://extensions`
3. Enable **Developer mode** (top right)
4. **Load unpacked** -> select that folder
5. Reload any open Webtoons tabs

Cloning the repository and pointing **Load unpacked** at it works the same way.

To turn it off, switch the extension off at `chrome://extensions`.
