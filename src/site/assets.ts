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

/**
 * Page-owned botanical artwork. SVGs and photographs deliberately live in
 * separate source directories so a decorative vector cannot silently become a
 * raster fallback (or vice versa) during the website build.
 */
export const PUBLIC_SITE_BOTANICAL_ASSETS = {
  about: {
    svg: "botanical/svg/about-botanical.svg",
    svgId: "about-botanical",
    svgViewBox: "0 0 420 520",
    image: "botanical/images/about-botanical-photo.jpg",
    imageWidth: 1122,
    imageHeight: 1402,
  },
  community: {
    svg: "botanical/svg/community-botanical.svg",
    svgId: "community-botanical",
    svgViewBox: "0 0 440 520",
    image: "botanical/images/community-botanical-photo.jpg",
    imageWidth: 1448,
    imageHeight: 1086,
  },
  models: {
    svg: "botanical/svg/models-botanical.svg",
    svgId: "models-botanical",
    svgViewBox: "0 0 420 520",
    image: "botanical/images/models-botanical-photo.jpg",
    imageWidth: 1122,
    imageHeight: 1402,
  },
} as const;

export type PublicSiteBotanicalAsset = (typeof PUBLIC_SITE_BOTANICAL_ASSETS)[keyof typeof PUBLIC_SITE_BOTANICAL_ASSETS];

export const PUBLIC_SITE_BOTANICAL_ASSET_PATHS = Object.values(PUBLIC_SITE_BOTANICAL_ASSETS).flatMap(
  ({ svg, image }) => [svg, image],
);
