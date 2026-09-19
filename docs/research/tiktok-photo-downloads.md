# TikTok photo downloads: feasibility and quality

Research date: 2026-09-19. Scope: source and documentation review only. No user-supplied TikTok URL was available, and no live photo download was tested. Recommendations below are proposals, not accepted product decisions.

## Findings

- A TikTok photo post (one image or a carousel) is different from a video's cover image. TikTok's help search result describes saving selected photos or all photos when the creator enables downloads. The full help page failed to load in the research tool, so this point relies on its indexed first-party excerpt. [TikTok help](https://support.tiktok.com/en/using-tiktok/exploring-videos/video-downloads)
- Current gallery-dl source has explicit photo-post support: it reads `imagePost.images`, downloads each `imageURL.urlList[0]`, retains image order and dimensions, and handles video covers separately. This is evidence of implementation support, not a guarantee that every live post works. The inspected code does not rank every CDN variant or prove that the selected URL contains the uploader's original bytes. [gallery-dl TikTok extractor](https://github.com/mikf/gallery-dl/blob/master/gallery_dl/extractor/tiktok.py)
- Current yt-dlp TikTok master source extracts video formats and cover thumbnails, without a photo-carousel image extraction path. The slideshow PR remains open; its maintainer requested a different representation instead of downloading JPEG playlists. Do not describe this PR as released support. [yt-dlp extractor](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/tiktok.py), [PR #17016](https://github.com/yt-dlp/yt-dlp/pull/17016)
- PNG stores raster pixels losslessly. Consequently, converting an already compressed image to PNG can avoid further lossy encoding, but cannot recreate details discarded before download. That second statement is an inference from lossless storage of the available decoded pixels. [W3C PNG specification](https://www.w3.org/TR/png-3/)
- JPEG export quality is an encoding decision, separate from source resolution. Pillow's documentation recommends avoiding quality values above 95 and exposes chroma subsampling controls; a setting of 100 is not a promise of lossless recovery. These are Pillow-specific settings, not universal encoder parameters. [Pillow JPEG documentation](https://pillow.readthedocs.io/en/stable/handbook/image-file-formats.html#jpeg)

## Proposed product contract

Use the label **highest quality available from TikTok**, not **original uploader file** or a fixed 4K promise. Resolve the actual photo media, preserve pixel dimensions, and validate the downloaded image. A preview thumbnail must not silently substitute for a photo. If multiple genuine source variants are exposed, compare the available metadata and decoded dimensions; file size alone does not establish image quality. This is an engineering recommendation, not a documented TikTok quality guarantee.

Offer PNG and JPG as requested. PNG preserves the decoded pixels without additional lossy compression; JPG prioritizes convenient photo sharing and usually smaller files. If the fetched image is already a JPEG and JPG was selected, prefer preserving its bytes instead of recompressing it. Format conversion must produce a real encoded file, not merely change the extension. Neither format choice guarantees acceptance by every destination service.

Keep the UI small: paste link, see images, choose PNG/JPG, download. Resolve whether the user wants photo posts, video covers, or both, and whether downloading all photos is sufficient or selection is required. Do not add a quality slider when the requested default is the best available source.

## Implementation boundary and remaining verification

The project owner reports that the existing Rust flow currently exposes JPG thumbnails and uses yt-dlp `--write-thumbnail --skip-download --convert-thumbnails jpg`. This is local inspection reported by the parent task, not an independent code review in this research note. It explains why changing the format control alone would not establish carousel support.

Before implementing a new extractor, test representative user URLs with the project's installed downloader version: single photo, carousel, video cover, and shared short link. Check decoded dimensions, number/order of images, actual output format, and failure behavior. Prefer the existing media tooling for conversion; gallery-dl is a candidate for photo extraction, not an approved new dependency. Source review alone cannot settle live access, CDN URL lifetime, watermark behavior, or availability of higher-quality variants for the user's posts. Do not promise all posts or all original files.
