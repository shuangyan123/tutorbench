/**
 * Explicit public raster allow-list.
 *
 * The static site must copy only reviewed public artwork. Keeping the list in
 * source makes the build boundary and its tests agree without wildcarding the
 * image directory or accidentally publishing a private/local artifact.
 */
export const PUBLIC_SITE_RASTER_ASSETS = [
  "foliage.png",
  "foliage-left-near.webp",
  "foliage-left-mid.webp",
  "foliage-right-mid.webp",
  "foliage-right-near.webp",
  "home-hero-bg.webp",
  "home-open-data-bg.webp",
  "home-blog-01.webp",
  "home-blog-02.webp",
  "home-blog-03.webp",
] as const;

export type PublicSiteRasterAsset = (typeof PUBLIC_SITE_RASTER_ASSETS)[number];
