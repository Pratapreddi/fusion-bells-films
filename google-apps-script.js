/**
 * ============================================================
 * FUSION BELLS FILMS — Google Drive Gallery API
 * Root folder ID: 1i_WpYgn7Jn4km10IWl5Mb2DlfVM2lPxB
 * ============================================================
 *
 * WHAT IT DOES
 * Walks the whole Drive tree (not just the first level) and turns every
 * wedding subfolder into a gallery category on the website.
 *
 * EXPECTED FOLDER SHAPE (matches your Drive today):
 *
 *   Fusion Bells Films/
 *     Photos/
 *       DUBAI PRE WED (1)/   -> category "Dubai Pre Wed"
 *       Engagement/          -> category "Engagement"
 *       Haldi & wedding/     -> category "Haldi & Wedding"
 *       Monisha & Mohith/    -> category "Monisha & Mohith"
 *       Prewedding/          -> category "Prewedding"
 *       Reception/           -> category "Reception"
 *       Sanjana/             -> category "Sanjana"
 *       Wedding Photos/      -> category "Wedding Photos"
 *     Founder/               -> founder portrait (NOT shown in the gallery)
 *     Logo/                  -> ignored
 *     Video/                 -> wedding films, returned in `videos` (NOT in the
 *                               photo gallery). Name files
 *                               "Gowthami & Samarth - Pre-wedding film.mp4"
 *                               and the site splits that into title + caption.
 *
 * Nested folders deeper than that (e.g. Photos/Engagement/Selects) are
 * rolled up into their nearest named category.
 *
 * ============================================================
 * HOW TO (RE)DEPLOY  — required for any change here to go live
 * ============================================================
 * 1. Open https://script.google.com/ and open your existing project
 *    ("Fusion Bells Films Gallery API").
 * 2. Select all the old code and paste this entire file over it. Save.
 * 3. Click "Deploy" > "Manage deployments".
 * 4. Click the pencil (Edit) on the active deployment.
 * 5. Under "Version" choose "New version", then click "Deploy".
 *    -> This keeps the SAME /exec URL, so the website needs no change.
 *    (Using "New deployment" instead creates a NEW url — if you do that,
 *     paste the new /exec url into GDRIVE_API_URL in app.js.)
 * 6. Load the /exec url in a browser to confirm you see the new JSON.
 *
 * NOTE: results are cached for 3 hours. After uploading new photos, either
 * wait, or open  <your /exec url>?refresh=1  once to rebuild immediately.
 */

const ROOT_FOLDER_ID = "1i_WpYgn7Jn4km10IWl5Mb2DlfVM2lPxB";

// Folder names that are never gallery categories.
const IGNORED_FOLDERS  = ["logo", "logos", "branding", "raw", "private"];
// Films live here. They are returned in their own `videos` array — never mixed
// into the photo gallery.
const VIDEO_FOLDERS    = ["video", "videos", "films", "film"];
// Folder holding the founder portrait.
const FOUNDER_FOLDERS  = ["founder", "founders", "about", "team"];
// Pass-through containers: their SUBFOLDERS become the categories.
const CONTAINER_FOLDERS = ["photos", "photo", "gallery", "galleries", "portfolio"];

// Keep the payload small enough to stay fast on mobile.
const MAX_PER_CATEGORY = 30;
const MAX_VIDEOS       = 24;
const MAX_TOTAL        = 240;
const CACHE_SECONDS    = 3 * 60 * 60;

function doGet(e) {
  const wantsRefresh = e && e.parameter && e.parameter.refresh;
  const cache = CacheService.getScriptCache();

  if (!wantsRefresh) {
    try {
      const hit = cache.get("fbf_gallery_payload");
      if (hit) return json(hit);
    } catch (err) { /* cache miss is fine */ }
  }

  try {
    const root = DriveApp.getFolderById(ROOT_FOLDER_ID);

    const buckets = {};   // slug -> { name, files: [] }
    const order   = [];   // preserves discovery order
    const videos  = [];
    let founder   = null;

    function slugify(text) {
      return String(text).toLowerCase()
        .replace(/\([^)]*\)/g, " ")          // drop "(1)" style suffixes
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }

    function prettify(text) {
      return String(text).replace(/\([^)]*\)/g, "").replace(/[_-]+/g, " ").trim()
        .replace(/\s+/g, " ")
        .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }

    function isImage(file) {
      return file.getMimeType().indexOf("image/") === 0;
    }

    function push(file, slug, name) {
      if (!isImage(file)) return;
      if (!buckets[slug]) { buckets[slug] = { name: name, files: [] }; order.push(slug); }
      if (buckets[slug].files.length >= MAX_PER_CATEGORY) return;
      buckets[slug].files.push(file);
    }

    // Depth-first walk. `slug`/`name` is the category the current folder
    // contributes to; null means "this folder only routes its children".
    function walk(folder, slug, name, depth) {
      if (depth > 4) return;

      const files = folder.getFiles();
      while (files.hasNext()) {
        const file = files.next();
        if (slug) push(file, slug, name);
      }

      const subs = folder.getFolders();
      while (subs.hasNext()) {
        const sub     = subs.next();
        const rawName = sub.getName().trim();
        const key     = rawName.toLowerCase();

        if (IGNORED_FOLDERS.indexOf(key) !== -1) continue;

        if (VIDEO_FOLDERS.indexOf(key) !== -1) {
          collectVideos(sub, 0);
          continue;
        }

        if (FOUNDER_FOLDERS.indexOf(key) !== -1) {
          if (!founder) founder = firstImage(sub);
          continue;
        }

        if (CONTAINER_FOLDERS.indexOf(key) !== -1) {
          walk(sub, null, null, depth + 1);           // children become categories
          continue;
        }

        if (slug) {
          walk(sub, slug, name, depth + 1);           // roll up into parent category
        } else {
          walk(sub, slugify(rawName), prettify(rawName), depth + 1);
        }
      }
    }

    // Two independent Google image hosts for the same file. The site tries
    // the first and silently falls back to the second, which keeps the
    // gallery intact when one host rate-limits a burst of requests.
    function driveUrl(id, width) {
      return "https://drive.google.com/thumbnail?id=" + id + "&sz=w" + width;
    }
    function lh3Url(id, width) {
      return "https://lh3.googleusercontent.com/d/" + id + "=w" + width;
    }
    function cleanTitle(name) {
      return name.replace(/(\.[A-Za-z]{2,5})+$/, "").replace(/[-_]+/g, " ").trim();
    }

    /**
     * Turns a working filename into something presentable.
     * "04 Gowthami & Samarth__Prewed Song CC 25.04.2024.mp4"
     *   -> { title: "Gowthami & Samarth", label: "Prewed Song CC" }
     * Also handles "Couple Name - Teaser.mp4" and "Couple | Wedding film.mp4".
     */
    function parseFilmName(name) {
      let bare = name.replace(/\.(mp4|mov|m4v|webm|avi|mkv|mpg|mpeg)$/i, "");   // video extension
      bare = bare.replace(/^\d{1,3}[\s._-]+/, "");             // leading "04 " index
      const parts = bare.split(/__+|\s+[-–—]\s+|\s*\|\s*/);

      const title = (parts[0] || bare).replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
      let label = parts.slice(1).join(" ")
        .replace(/\b\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}\b/g, "")  // trailing dates
        .replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();

      return { title: title || "Wedding film", label: label || "Wedding film" };
    }

    function collectVideos(folder, depth) {
      if (depth > 3 || videos.length >= MAX_VIDEOS) return;

      const files = folder.getFiles();
      while (files.hasNext() && videos.length < MAX_VIDEOS) {
        const f = files.next();
        if (f.getMimeType().indexOf("video/") !== 0) continue;
        const id = f.getId();
        const named = parseFilmName(f.getName());
        videos.push({
          id: id,
          type: "drive",
          title: named.title,
          label: named.label,
          poster: driveUrl(id, 1280),
          src: "https://drive.google.com/file/d/" + id + "/preview"
        });
      }

      const subs = folder.getFolders();
      while (subs.hasNext() && videos.length < MAX_VIDEOS) collectVideos(subs.next(), depth + 1);
    }

    function firstImage(folder) {
      const files = folder.getFiles();
      while (files.hasNext()) {
        const f = files.next();
        if (isImage(f)) {
          return {
            id: f.getId(),
            name: f.getName(),
            thumb: driveUrl(f.getId(), 900),
            full: driveUrl(f.getId(), 1600),
            fullAlt: lh3Url(f.getId(), 1600)
          };
        }
      }
      // look one level deeper before giving up
      const subs = folder.getFolders();
      while (subs.hasNext()) {
        const found = firstImage(subs.next());
        if (found) return found;
      }
      return null;
    }

    walk(root, null, null, 0);

    // Interleave categories so the "All" view opens with a varied contact
    // sheet instead of 30 frames from one wedding in a row.
    const photos     = [];
    const categories = [];
    let frameIndex   = 1;

    order.forEach(function (slug) {
      const bucket = buckets[slug];
      if (!bucket.files.length) return;
      categories.push({ id: slug, name: bucket.name, count: bucket.files.length });
    });

    let cursor = 0;
    let added  = true;
    while (added && photos.length < MAX_TOTAL) {
      added = false;
      for (let i = 0; i < order.length && photos.length < MAX_TOTAL; i++) {
        const bucket = buckets[order[i]];
        if (!bucket || cursor >= bucket.files.length) continue;
        const file = bucket.files[cursor];
        const id   = file.getId();
        photos.push({
          id: id,
          frameNo: String(frameIndex++).padStart(2, "0"),
          title: cleanTitle(file.getName()),
          category: order[i],
          categoryName: bucket.name,
          thumb: driveUrl(id, 1000),
          thumbAlt: lh3Url(id, 1000),
          full: driveUrl(id, 2048),
          fullAlt: lh3Url(id, 2048)
        });
        added = true;
      }
      cursor++;
    }

    const payload = JSON.stringify({
      status: "success",
      folderId: ROOT_FOLDER_ID,
      generated: new Date().toISOString(),
      founder: founder,
      videos: videos,
      categories: categories,
      totalPhotos: photos.length,
      photos: photos
    });

    try { cache.put("fbf_gallery_payload", payload, CACHE_SECONDS); } catch (err) { /* too big to cache */ }
    return json(payload);

  } catch (err) {
    return json(JSON.stringify({ status: "error", message: err.toString() }));
  }
}

function json(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}
