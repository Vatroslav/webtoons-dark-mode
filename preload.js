// Webtoons Dark Mode - episode image preload.
//
// The viewer requests episode images almost sequentially: at most two in flight,
// and in most cases the next one is not requested until the previous one has
// finished. Measured over one episode (28 images), a single image took a median
// of 1.8 s - 0.8 s waiting on the CDN plus 0.8 s downloading - so scrolling
// faster than about one screen every two seconds outruns the loader and leaves
// blank space where the art should be.
//
// This warms the browser cache for the next few images while the ones above are
// still being read. The page's own loader is left untouched: nothing in the DOM
// is modified, so when it eventually sets `src` the file is already in cache
// (the CDN serves the images with `cache-control: max-age=2592000`) and the
// image appears immediately. A request that is still in flight is reused by the
// browser rather than sent twice.
(() => {
  'use strict';

  const AHEAD = 5;    // images to warm ahead of the one being read
  const PARALLEL = 3; // requests in flight, so the visible image keeps bandwidth

  const SEL = 'img._images[data-url]';
  if (!document.querySelector(SEL)) return; // not an episode viewer page

  const started = new Set();  // urls already requested
  const inFlight = new Set(); // Image objects, kept referenced until they settle

  function warm(url) {
    if (started.has(url)) return false;
    if (inFlight.size >= PARALLEL) return true; // full - try again on the next pass
    started.add(url);
    const img = new Image();
    img.fetchPriority = 'low'; // the image actually on screen comes first
    img.decoding = 'async';
    const done = () => {
      inFlight.delete(img);
      schedule(); // a slot freed up
    };
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
    inFlight.add(img);
    img.src = url;
    return false;
  }

  // Walks from the first image that is not scrolled past yet and warms the next
  // AHEAD images the page has not loaded itself.
  function scan() {
    let queued = 0;
    for (const img of document.querySelectorAll(SEL)) {
      if (img.getBoundingClientRect().bottom < 0) continue; // already read
      const url = img.getAttribute('data-url');
      if (!url || img.getAttribute('src') === url) continue; // page loaded it already
      if (warm(url)) return; // no free slot left
      if (++queued >= AHEAD) return;
    }
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scan();
    });
  }

  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  addEventListener('load', schedule);
  scan();
})();
