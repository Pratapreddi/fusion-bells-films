FUSION BELLS FILMS — video folder
=================================

WHAT LIVES HERE

  dubai.mp4        4K camera master   ~93 MB   NOT committed (gitignored)
  hero-loop.mp4    4K camera master   ~90 MB   NOT committed (gitignored)

  dubai-web.mp4    20s silent loop    ~6.8 MB  COMMITTED, live on the site
  hero-web.mp4     20s silent loop    ~6.7 MB  COMMITTED, live on the site

Only files ending in "-web.mp4" are committed. Masters stay on this machine.


WHY

Cloudflare refuses to serve any single file over 25 MB. The masters are
~90 MB each, so they can never go on the site — that is why the clips
played locally but not on fusionbellsfilms.com.

A 90 MB background loop would also make a phone visitor wait ~30 seconds
and spend 90 MB of data on decorative wallpaper. The 6.8 MB version looks
identical once it is behind a dark veil, and starts in about a second.


MAKING A NEW WEB LOOP

ffmpeg is blocked on this PC by Windows Smart App Control, so these are
made with Windows' own built-in encoder instead. From the project folder:

  powershell -File tools\make-web-loop.ps1 `
      -InPath  video\dubai.mp4 `
      -OutPath video\dubai-web.mp4 `
      -StartSeconds 12 -DurationSeconds 20

  python tools\faststart.py video\dubai-web.mp4

  -StartSeconds     where in the master the loop begins
  -DurationSeconds  keep it short; 20s is plenty for a loop
  -Bitrate          defaults to 2800000 (2.8 Mbps), fine for 1080p

The script always outputs 1920x1080, 25fps, and strips the audio track —
the loops are muted anyway, and a silent track is a common reason browsers
refuse to autoplay.

The second command moves the video index to the front of the file so
playback can start before the download finishes. Skip it and the browser
waits for the whole file before showing a single frame.


RULES OF THUMB

  - Keep every committed file under 10 MB. Hard ceiling is 25 MB.
  - Never commit a master. The "-web" suffix in .gitignore is what
    prevents it, so do not rename a master to match that pattern.
  - Full-length films do NOT belong here. They stream from the Google
    Drive "Video" folder and appear on the site automatically.
