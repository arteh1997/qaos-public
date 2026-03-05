"use client";

import { useState, useCallback } from "react";

const GUIDE_PREFIX = "page-guide-seen:";

function readHasSeen(storageKey: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(storageKey) === "true";
  } catch {
    // localStorage unavailable (private browsing)
    return false;
  }
}

/**
 * Tracks whether the user has seen a page's guide panel.
 * SSR-safe — reads localStorage via a lazy useState initializer.
 */
export function usePageGuide(pageKey: string) {
  const storageKey = `${GUIDE_PREFIX}${pageKey}`;
  const [hasSeen, setHasSeen] = useState(() => readHasSeen(storageKey));

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(storageKey, "true");
    } catch {
      // Ignore storage failures
    }
    setHasSeen(true);
  }, [storageKey]);

  return { hasSeen, markSeen };
}
