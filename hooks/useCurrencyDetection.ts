"use client";

import { useState } from "react";
import {
  COUNTRY_CURRENCY,
  getPricingTier,
  type PricingTier,
} from "@/lib/stripe/billing-config";

/**
 * Map IANA timezone strings to ISO country codes.
 * Covers all countries in COUNTRY_CURRENCY + common variants.
 */
const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  // UK
  "Europe/London": "GB",
  // Americas
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Phoenix": "US",
  "America/Anchorage": "US",
  "Pacific/Honolulu": "US",
  "America/Detroit": "US",
  "America/Indiana/Indianapolis": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Edmonton": "CA",
  "America/Winnipeg": "CA",
  "America/Halifax": "CA",
  "America/St_Johns": "CA",
  // Middle East
  "Asia/Riyadh": "SA",
  "Asia/Dubai": "AE",
  "Asia/Bahrain": "BH",
  "Asia/Kuwait": "KW",
  "Asia/Muscat": "OM",
  "Asia/Qatar": "QA",
  // Asia-Pacific
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Australia/Brisbane": "AU",
  "Australia/Perth": "AU",
  "Australia/Adelaide": "AU",
  "Australia/Hobart": "AU",
  "Pacific/Auckland": "NZ",
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  // Europe (EUR)
  "Europe/Berlin": "DE",
  "Europe/Paris": "FR",
  "Europe/Madrid": "ES",
  "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE",
  "Europe/Vienna": "AT",
  "Europe/Lisbon": "PT",
  "Europe/Dublin": "IE",
  "Europe/Helsinki": "FI",
  "Europe/Athens": "GR",
  "Europe/Luxembourg": "LU",
  "Europe/Bratislava": "SK",
  "Europe/Ljubljana": "SI",
  "Europe/Tallinn": "EE",
  "Europe/Riga": "LV",
  "Europe/Vilnius": "LT",
  "Europe/Malta": "MT",
  "Asia/Nicosia": "CY",
  "Europe/Zagreb": "HR",
};

/**
 * Map browser locale strings to country codes.
 */
const LOCALE_TO_COUNTRY: Record<string, string> = {
  "en-GB": "GB",
  "en-US": "US",
  "en-AU": "AU",
  "en-CA": "CA",
  "en-IN": "IN",
  "en-NZ": "NZ",
  "en-IE": "IE",
  "fr-FR": "FR",
  "fr-CA": "CA",
  "fr-BE": "BE",
  "de-DE": "DE",
  "de-AT": "AT",
  "es-ES": "ES",
  "it-IT": "IT",
  "nl-NL": "NL",
  "nl-BE": "BE",
  "pt-PT": "PT",
  "fi-FI": "FI",
  "el-GR": "GR",
  "ar-SA": "SA",
  "ar-AE": "AE",
  "ar-BH": "BH",
  "ar-KW": "KW",
  "ar-OM": "OM",
  "ar-QA": "QA",
  "hi-IN": "IN",
};

function detectCountryFromBrowser(): string {
  if (typeof window === "undefined") return "GB";

  // Strategy 1: Timezone (most reliable — reflects physical location)
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) {
      const country = TIMEZONE_TO_COUNTRY[timezone];
      if (country) return country;
    }
  } catch {
    // Intl not supported
  }

  // Strategy 2: Navigator language locale tag
  try {
    const lang = navigator.language || navigator.languages?.[0];
    if (lang) {
      // Try full locale first (e.g. en-US)
      const fullMatch = LOCALE_TO_COUNTRY[lang];
      if (fullMatch) return fullMatch;

      // Try extracting region from locale tag (en-US → US)
      const parts = lang.split("-");
      if (parts.length > 1) {
        const region = parts[parts.length - 1].toUpperCase();
        if (COUNTRY_CURRENCY[region]) return region;
      }
    }
  } catch {
    // Navigator not available
  }

  // Fallback to GBP (UK)
  return "GB";
}

/**
 * Detects the user's likely currency from browser timezone and language.
 * No API calls, no IP geolocation — purely client-side.
 */
export function useCurrencyDetection(): {
  tier: PricingTier;
  currencyCode: string;
  countryCode: string;
  isDetected: boolean;
} {
  // Use lazy initializer — detectCountryFromBrowser() guards against SSR with typeof window check
  const [state] = useState(() => {
    const country = detectCountryFromBrowser();
    const currency = COUNTRY_CURRENCY[country] || "GBP";
    return { currencyCode: currency, countryCode: country, isDetected: true };
  });

  return {
    tier: getPricingTier(state.currencyCode),
    currencyCode: state.currencyCode,
    countryCode: state.countryCode,
    isDetected: state.isDetected,
  };
}
