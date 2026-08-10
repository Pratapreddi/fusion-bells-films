/**
 * ============================================================
 * FUSION BELLS FILMS — Google Apps Script for Gallery
 * Folder ID: 1i_WpYgn7Jn4km10IWl5Mb2DlfVM2lPxB
 * ============================================================
 *
 * HOW TO DEPLOY:
 * 1. Go to https://script.google.com/ and click "New project".
 * 2. Delete existing code and paste this entire file.
 * 3. Click "Deploy" > "New deployment".
 * 4. Select type: "Web app".
 * 5. Set:
 *    - Description: "Fusion Bells Films Gallery API"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone" (CRITICAL for website access)
 * 6. Click "Deploy" and authorize permissions.
 * 7. Copy the "Web App URL" (ends with /exec).
 * 8. Paste that URL into your `app.js` in `GDRIVE_API_URL`.
 */

const ROOT_FOLDER_ID = "1i_WpYgn7Jn4km10IWl5Mb2DlfVM2lPxB";

function doGet(e) {
  try {
    const rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
    const categoriesMap = {};
    const photos = [];
    let frameIndex = 1;

    function slugify(text) {
      return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    function addPhoto(file, categorySlug, categoryName) {
      const mime = file.getMimeType();
      if (mime.indexOf('image/') !== -1) {
        const fileId = file.getId();
        const thumbUrl = "https://lh3.googleusercontent.com/d/" + fileId + "=w1000";
        const fullUrl = "https://lh3.googleusercontent.com/d/" + fileId + "=w2048";

        photos.push({
          id: fileId,
          frameNo: String(frameIndex++).padStart(2, '0'),
          title: file.getName().replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
          category: categorySlug,
          categoryName: categoryName,
          thumb: thumbUrl,
          full: fullUrl
        });

        if (categorySlug !== 'all' && categorySlug !== 'logo') {
          categoriesMap[categorySlug] = categoryName;
        }
      }
    }

    // 1. Scan subfolders of Root
    const subfolders = rootFolder.getFolders();
    while (subfolders.hasNext()) {
      const folder = subfolders.next();
      const folderName = folder.getName().trim();
      const folderSlug = slugify(folderName);

      // If this is the "Photos" folder, check for nested categories (e.g. Photos/Haldi, Photos/Ceremony)
      if (folderSlug === 'photos') {
        const nestedFolders = folder.getFolders();
        let hasNested = false;
        while (nestedFolders.hasNext()) {
          hasNested = true;
          const nested = nestedFolders.next();
          const nestedName = nested.getName().trim();
          const nestedSlug = slugify(nestedName);

          const nestedFiles = nested.getFiles();
          while (nestedFiles.hasNext()) {
            addPhoto(nestedFiles.next(), nestedSlug, nestedName);
          }
        }

        // Direct files in Photos folder
        const directFiles = folder.getFiles();
        while (directFiles.hasNext()) {
          addPhoto(directFiles.next(), "featured", "Featured");
        }
      } else if (folderSlug !== 'video') {
        // Normal subfolder (e.g. Haldi, Ceremony, Logo)
        const files = folder.getFiles();
        while (files.hasNext()) {
          addPhoto(files.next(), folderSlug, folderName);
        }
      }
    }

    // 2. Direct files in Root folder
    const rootFiles = rootFolder.getFiles();
    while (rootFiles.hasNext()) {
      addPhoto(rootFiles.next(), "featured", "Featured");
    }

    const categories = Object.keys(categoriesMap).map(function(key) {
      return { id: key, name: categoriesMap[key] };
    });

    const output = {
      status: "success",
      folderId: ROOT_FOLDER_ID,
      categories: categories,
      totalPhotos: photos.length,
      photos: photos
    };

    return ContentService.createTextOutput(JSON.stringify(output))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    const errorOutput = {
      status: "error",
      message: err.toString()
    };
    return ContentService.createTextOutput(JSON.stringify(errorOutput))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
