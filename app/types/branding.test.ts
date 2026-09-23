import { describe, expect, it } from "vitest";
import {
  APP_ID,
  APP_NAME,
  applyBrandColorMigration,
  BRAND_BACKGROUND_COLOR,
  BRAND_TEXT_COLOR,
  LEGACY_BREAKTIMER_BACKGROUND_COLOR,
} from "./branding";
import { defaultSettings } from "./settings";

describe("LAQ branding", () => {
  it("uses Legal Aid Queensland identity and teal defaults", () => {
    expect(APP_NAME).toBe("LAQ BreakTimer");
    expect(APP_ID).toBe("au.gov.qld.legalaid.breaktimer");
    expect(defaultSettings.backgroundColor).toBe(BRAND_BACKGROUND_COLOR);
    expect(defaultSettings.textColor).toBe(BRAND_TEXT_COLOR);
    expect(BRAND_BACKGROUND_COLOR).toBe("#0F8291");
  });

  it("migrates the upstream BreakTimer teal to LAQ teal", () => {
    expect(
      applyBrandColorMigration({
        backgroundColor: LEGACY_BREAKTIMER_BACKGROUND_COLOR,
        textColor: "#ffffff",
      }),
    ).toEqual({
      backgroundColor: BRAND_BACKGROUND_COLOR,
      textColor: BRAND_TEXT_COLOR,
    });
  });

  it("leaves custom colours unchanged", () => {
    const custom = {
      backgroundColor: "#00426E",
      textColor: "#F1F4F5",
    };

    expect(applyBrandColorMigration(custom)).toEqual(custom);
  });
});
