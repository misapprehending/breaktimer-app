export const APP_NAME = "LAQ BreakTimer";
export const APP_ID = "au.gov.qld.legalaid.breaktimer";

/**
 * Legal Aid Queensland website palette (legalaid.qld.gov.au).
 * Teal is the primary accent used for buttons, links, and emphasis.
 */
export const BRAND_BACKGROUND_COLOR = "#0F8291";
export const BRAND_TEXT_COLOR = "#ffffff";
export const BRAND_NAVY_COLOR = "#002742";
export const BRAND_TEAL_LIGHT_COLOR = "#3DACBA";

export const LEGACY_BREAKTIMER_BACKGROUND_COLOR = "#16a085";

export const GITHUB_OWNER = "misapprehending";
export const GITHUB_REPO = "breaktimer-app";
export const GITHUB_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
export const GITHUB_RELEASES_URL = `${GITHUB_URL}/releases`;
export const WEBSITE_URL = "https://www.legalaid.qld.gov.au";
export const UPSTREAM_URL =
  "https://github.com/tom-james-watson/breaktimer-app";

export function applyBrandColorMigration<
  T extends { backgroundColor?: string; textColor?: string },
>(settings: T): T {
  const backgroundColor = settings.backgroundColor?.toLowerCase();
  const textColor = settings.textColor?.toLowerCase();
  const isLegacyDefault =
    backgroundColor === LEGACY_BREAKTIMER_BACKGROUND_COLOR &&
    (textColor === undefined || textColor === BRAND_TEXT_COLOR);

  if (!isLegacyDefault) {
    return settings;
  }

  return {
    ...settings,
    backgroundColor: BRAND_BACKGROUND_COLOR,
    textColor: BRAND_TEXT_COLOR,
  };
}
