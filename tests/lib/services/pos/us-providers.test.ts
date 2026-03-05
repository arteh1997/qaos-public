import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import crypto from "crypto";

import {
  validateParBrinkSignature,
  validateHeartlandSignature,
  validateHungerRushSignature,
  validateCakeSignature,
  validateLavuSignature,
  validateFocusPosSignature,
  validateShopifyPosSignature,
  validateAldeloExpressSignature,
  validateSquirrelSignature,
  validateGoTabSignature,
  validateXenialSignature,
  validateQuPosSignature,
  validateFuturePosSignature,
  validateUpserveSignature,
  validateSicomSignature,
  validatePosiTouchSignature,
  validateHarbortouchSignature,
  validateDigitalDiningSignature,
  validateMaitredSignature,
  validateSpeedlineSignature,
} from "@/lib/services/pos/webhook-validators";

import { parBrinkAdapter } from "@/lib/services/pos/adapters/par-brink";
import { heartlandAdapter } from "@/lib/services/pos/adapters/heartland";
import { hungerRushAdapter } from "@/lib/services/pos/adapters/hungerrush";
import { cakeAdapter } from "@/lib/services/pos/adapters/cake";
import { lavuAdapter } from "@/lib/services/pos/adapters/lavu";
import { focusPosAdapter } from "@/lib/services/pos/adapters/focus-pos";
import { shopifyPosAdapter } from "@/lib/services/pos/adapters/shopify-pos";
import { aldeloExpressAdapter } from "@/lib/services/pos/adapters/aldelo-express";
import { squirrelAdapter } from "@/lib/services/pos/adapters/squirrel";
import { goTabAdapter } from "@/lib/services/pos/adapters/gotab";
import { xenialAdapter } from "@/lib/services/pos/adapters/xenial";
import { quPosAdapter } from "@/lib/services/pos/adapters/qu-pos";
import { futurePosAdapter } from "@/lib/services/pos/adapters/future-pos";
import { upserveAdapter } from "@/lib/services/pos/adapters/upserve";
import { sicomAdapter } from "@/lib/services/pos/adapters/sicom";
import { posiTouchAdapter } from "@/lib/services/pos/adapters/positouch";
import { harbortouchAdapter } from "@/lib/services/pos/adapters/harbortouch";
import { digitalDiningAdapter } from "@/lib/services/pos/adapters/digital-dining";
import { maitredAdapter } from "@/lib/services/pos/adapters/maitred";
import { speedlineAdapter } from "@/lib/services/pos/adapters/speedline";

// ── Helpers ──────────────────────────────────────────────────────────────────

function hmacHex(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function hmacBase64(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64");
}

const TEST_SECRET = "whsec_test_secret_key_12345";
const TEST_PAYLOAD = JSON.stringify({
  type: "payment.completed",
  merchant_id: "store_abc",
  data: { order_id: "order_123", amount: 2499 },
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1: Webhook Signature Validators
// ═══════════════════════════════════════════════════════════════════════════════

// ── PAR Brink ────────────────────────────────────────────────────────────────

describe("validateParBrinkSignature", () => {
  it("should accept a valid hex signature", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateParBrinkSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(
      true,
    );
  });

  it("should return false for an invalid signature (same-length hex)", () => {
    const wrongSig = hmacHex("different-payload-for-par-brink", TEST_SECRET);
    expect(validateParBrinkSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(
      false,
    );
  });

  it("should return false for a tampered payload", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    const tampered = TEST_PAYLOAD.replace("order_123", "order_hacked");
    expect(validateParBrinkSignature(tampered, sig, TEST_SECRET)).toBe(false);
  });

  it("should return false when a wrong secret is used", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateParBrinkSignature(TEST_PAYLOAD, sig, "wrong_secret")).toBe(
      false,
    );
  });

  it("should throw for an empty signature (length mismatch)", () => {
    expect(() =>
      validateParBrinkSignature(TEST_PAYLOAD, "", TEST_SECRET),
    ).toThrow();
  });
});

// ── Heartland ────────────────────────────────────────────────────────────────

describe("validateHeartlandSignature", () => {
  it("should accept a valid hex signature", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateHeartlandSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(
      true,
    );
  });

  it("should return false for an invalid signature (same-length hex)", () => {
    const wrongSig = hmacHex("different-payload-for-heartland", TEST_SECRET);
    expect(
      validateHeartlandSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET),
    ).toBe(false);
  });

  it("should return false for a tampered payload", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    const tampered = TEST_PAYLOAD.replace("store_abc", "store_evil");
    expect(validateHeartlandSignature(tampered, sig, TEST_SECRET)).toBe(false);
  });

  it("should return false when a wrong secret is used", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(
      validateHeartlandSignature(TEST_PAYLOAD, sig, "heartland_wrong"),
    ).toBe(false);
  });

  it("should throw for an empty signature (length mismatch)", () => {
    expect(() =>
      validateHeartlandSignature(TEST_PAYLOAD, "", TEST_SECRET),
    ).toThrow();
  });
});

// ── HungerRush ───────────────────────────────────────────────────────────────

describe("validateHungerRushSignature", () => {
  it("should accept a valid hex signature", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateHungerRushSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(
      true,
    );
  });

  it("should return false for an invalid signature (same-length hex)", () => {
    const wrongSig = hmacHex("different-payload-for-hungerrush", TEST_SECRET);
    expect(
      validateHungerRushSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET),
    ).toBe(false);
  });

  it("should return false for a tampered payload", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    const tampered = TEST_PAYLOAD.replace("2499", "1");
    expect(validateHungerRushSignature(tampered, sig, TEST_SECRET)).toBe(false);
  });

  it("should return false when a wrong secret is used", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(
      validateHungerRushSignature(TEST_PAYLOAD, sig, "hungerrush_bad"),
    ).toBe(false);
  });

  it("should throw for an empty signature (length mismatch)", () => {
    expect(() =>
      validateHungerRushSignature(TEST_PAYLOAD, "", TEST_SECRET),
    ).toThrow();
  });
});

// ── CAKE ─────────────────────────────────────────────────────────────────────

describe("validateCakeSignature", () => {
  it("should accept a valid hex signature", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateCakeSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true);
  });

  it("should return false for an invalid signature (same-length hex)", () => {
    const wrongSig = hmacHex("different-payload-for-cake", TEST_SECRET);
    expect(validateCakeSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(
      false,
    );
  });

  it("should return false for a tampered payload", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    const tampered = TEST_PAYLOAD.replace(
      "payment.completed",
      "payment.failed",
    );
    expect(validateCakeSignature(tampered, sig, TEST_SECRET)).toBe(false);
  });

  it("should return false when a wrong secret is used", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateCakeSignature(TEST_PAYLOAD, sig, "cake_expired_key")).toBe(
      false,
    );
  });

  it("should throw for an empty signature (length mismatch)", () => {
    expect(() =>
      validateCakeSignature(TEST_PAYLOAD, "", TEST_SECRET),
    ).toThrow();
  });
});

// ── Lavu ─────────────────────────────────────────────────────────────────────

describe("validateLavuSignature", () => {
  it("should accept a valid hex signature", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateLavuSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true);
  });

  it("should return false for an invalid signature (same-length hex)", () => {
    const wrongSig = hmacHex("different-payload-for-lavu", TEST_SECRET);
    expect(validateLavuSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(
      false,
    );
  });

  it("should return false for a tampered payload", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    const tampered = TEST_PAYLOAD.replace("merchant_id", "attacker_id");
    expect(validateLavuSignature(tampered, sig, TEST_SECRET)).toBe(false);
  });

  it("should return false when a wrong secret is used", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateLavuSignature(TEST_PAYLOAD, sig, "lavu_wrong_key")).toBe(
      false,
    );
  });

  it("should throw for an empty signature (length mismatch)", () => {
    expect(() =>
      validateLavuSignature(TEST_PAYLOAD, "", TEST_SECRET),
    ).toThrow();
  });
});

// ── Focus POS ────────────────────────────────────────────────────────────────

describe("validateFocusPosSignature", () => {
  it("should accept a valid hex signature", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateFocusPosSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(
      true,
    );
  });

  it("should return false for an invalid signature (same-length hex)", () => {
    const wrongSig = hmacHex("different-payload-for-focus-pos", TEST_SECRET);
    expect(validateFocusPosSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(
      false,
    );
  });

  it("should return false for a tampered payload", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    const tampered = TEST_PAYLOAD.replace("order_123", "order_tampered");
    expect(validateFocusPosSignature(tampered, sig, TEST_SECRET)).toBe(false);
  });

  it("should return false when a wrong secret is used", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateFocusPosSignature(TEST_PAYLOAD, sig, "focus_leaked")).toBe(
      false,
    );
  });

  it("should throw for an empty signature (length mismatch)", () => {
    expect(() =>
      validateFocusPosSignature(TEST_PAYLOAD, "", TEST_SECRET),
    ).toThrow();
  });
});

// ── Shopify POS (base64) ────────────────────────────────────────────────────

describe("validateShopifyPosSignature", () => {
  it("should accept a valid base64 signature", () => {
    const sig = hmacBase64(TEST_PAYLOAD, TEST_SECRET);
    expect(validateShopifyPosSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(
      true,
    );
  });

  it("should return false for an invalid signature (same-length base64)", () => {
    const wrongSig = hmacBase64(
      "different-payload-for-shopify-pos",
      TEST_SECRET,
    );
    expect(
      validateShopifyPosSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET),
    ).toBe(false);
  });

  it("should return false for a tampered payload", () => {
    const sig = hmacBase64(TEST_PAYLOAD, TEST_SECRET);
    const tampered = TEST_PAYLOAD.replace("store_abc", "store_hacked");
    expect(validateShopifyPosSignature(tampered, sig, TEST_SECRET)).toBe(false);
  });

  it("should return false when a wrong secret is used", () => {
    const sig = hmacBase64(TEST_PAYLOAD, TEST_SECRET);
    expect(
      validateShopifyPosSignature(TEST_PAYLOAD, sig, "shopify_wrong"),
    ).toBe(false);
  });

  it("should throw for an empty signature (length mismatch)", () => {
    expect(() =>
      validateShopifyPosSignature(TEST_PAYLOAD, "", TEST_SECRET),
    ).toThrow();
  });
});

// ── Aldelo Express ───────────────────────────────────────────────────────────

describe("validateAldeloExpressSignature", () => {
  it("should accept a valid hex signature", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateAldeloExpressSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(
      true,
    );
  });

  it("should return false for an invalid signature (same-length hex)", () => {
    const wrongSig = hmacHex(
      "different-payload-for-aldelo-express",
      TEST_SECRET,
    );
    expect(
      validateAldeloExpressSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET),
    ).toBe(false);
  });

  it("should return false for a tampered payload", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    const tampered = TEST_PAYLOAD.replace("2499", "0");
    expect(validateAldeloExpressSignature(tampered, sig, TEST_SECRET)).toBe(
      false,
    );
  });

  it("should return false when a wrong secret is used", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(
      validateAldeloExpressSignature(TEST_PAYLOAD, sig, "aldelo_old_secret"),
    ).toBe(false);
  });

  it("should throw for an empty signature (length mismatch)", () => {
    expect(() =>
      validateAldeloExpressSignature(TEST_PAYLOAD, "", TEST_SECRET),
    ).toThrow();
  });
});

// ── Squirrel Systems ─────────────────────────────────────────────────────────

describe("validateSquirrelSignature", () => {
  it("should accept a valid hex signature", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateSquirrelSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(
      true,
    );
  });

  it("should return false for an invalid signature (same-length hex)", () => {
    const wrongSig = hmacHex("different-payload-for-squirrel", TEST_SECRET);
    expect(validateSquirrelSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(
      false,
    );
  });

  it("should return false for a tampered payload", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    const tampered = TEST_PAYLOAD.replace(
      "payment.completed",
      "payment.cancelled",
    );
    expect(validateSquirrelSignature(tampered, sig, TEST_SECRET)).toBe(false);
  });

  it("should return false when a wrong secret is used", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(
      validateSquirrelSignature(TEST_PAYLOAD, sig, "squirrel_rotated"),
    ).toBe(false);
  });

  it("should throw for an empty signature (length mismatch)", () => {
    expect(() =>
      validateSquirrelSignature(TEST_PAYLOAD, "", TEST_SECRET),
    ).toThrow();
  });
});

// ── GoTab ────────────────────────────────────────────────────────────────────

describe("validateGoTabSignature", () => {
  it("should accept a valid hex signature", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateGoTabSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true);
  });

  it("should return false for an invalid signature (same-length hex)", () => {
    const wrongSig = hmacHex("different-payload-for-gotab", TEST_SECRET);
    expect(validateGoTabSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(
      false,
    );
  });

  it("should return false for a tampered payload", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    const tampered = TEST_PAYLOAD.replace("store_abc", "store_modified");
    expect(validateGoTabSignature(tampered, sig, TEST_SECRET)).toBe(false);
  });

  it("should return false when a wrong secret is used", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateGoTabSignature(TEST_PAYLOAD, sig, "gotab_compromised")).toBe(
      false,
    );
  });

  it("should throw for an empty signature (length mismatch)", () => {
    expect(() =>
      validateGoTabSignature(TEST_PAYLOAD, "", TEST_SECRET),
    ).toThrow();
  });
});

// ── Xenial ───────────────────────────────────────────────────────────────────

describe("validateXenialSignature", () => {
  it("should accept a valid hex signature", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateXenialSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true);
  });

  it("should return false for an invalid signature (same-length hex)", () => {
    const wrongSig = hmacHex("different-payload-for-xenial", TEST_SECRET);
    expect(validateXenialSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(
      false,
    );
  });

  it("should return false for a tampered payload", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    const tampered = TEST_PAYLOAD.replace("order_123", "order_xenial_hack");
    expect(validateXenialSignature(tampered, sig, TEST_SECRET)).toBe(false);
  });

  it("should return false when a wrong secret is used", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateXenialSignature(TEST_PAYLOAD, sig, "xenial_bad_key")).toBe(
      false,
    );
  });

  it("should throw for an empty signature (length mismatch)", () => {
    expect(() =>
      validateXenialSignature(TEST_PAYLOAD, "", TEST_SECRET),
    ).toThrow();
  });
});

// ── Qu POS ───────────────────────────────────────────────────────────────────

describe("validateQuPosSignature", () => {
  it("should accept a valid hex signature", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateQuPosSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true);
  });

  it("should return false for an invalid signature (same-length hex)", () => {
    const wrongSig = hmacHex("different-payload-for-qu-pos", TEST_SECRET);
    expect(validateQuPosSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(
      false,
    );
  });

  it("should return false for a tampered payload", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    const tampered = TEST_PAYLOAD.replace("merchant_id", "rogue_id");
    expect(validateQuPosSignature(tampered, sig, TEST_SECRET)).toBe(false);
  });

  it("should return false when a wrong secret is used", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateQuPosSignature(TEST_PAYLOAD, sig, "qu_pos_expired")).toBe(
      false,
    );
  });

  it("should throw for an empty signature (length mismatch)", () => {
    expect(() =>
      validateQuPosSignature(TEST_PAYLOAD, "", TEST_SECRET),
    ).toThrow();
  });
});

// ── Future POS ───────────────────────────────────────────────────────────────

describe("validateFuturePosSignature", () => {
  it("should accept a valid hex signature", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateFuturePosSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(
      true,
    );
  });

  it("should return false for an invalid signature (same-length hex)", () => {
    const wrongSig = hmacHex("different-payload-for-future-pos", TEST_SECRET);
    expect(
      validateFuturePosSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET),
    ).toBe(false);
  });

  it("should return false for a tampered payload", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    const tampered = TEST_PAYLOAD.replace("2499", "9999");
    expect(validateFuturePosSignature(tampered, sig, TEST_SECRET)).toBe(false);
  });

  it("should return false when a wrong secret is used", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(
      validateFuturePosSignature(TEST_PAYLOAD, sig, "future_pos_wrong"),
    ).toBe(false);
  });

  it("should throw for an empty signature (length mismatch)", () => {
    expect(() =>
      validateFuturePosSignature(TEST_PAYLOAD, "", TEST_SECRET),
    ).toThrow();
  });
});

// ── Upserve ──────────────────────────────────────────────────────────────────

describe("validateUpserveSignature", () => {
  it("should accept a valid hex signature", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateUpserveSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true);
  });

  it("should return false for an invalid signature (same-length hex)", () => {
    const wrongSig = hmacHex("different-payload-for-upserve", TEST_SECRET);
    expect(validateUpserveSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(
      false,
    );
  });

  it("should return false for a tampered payload", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    const tampered = TEST_PAYLOAD.replace(
      "payment.completed",
      "payment.reversed",
    );
    expect(validateUpserveSignature(tampered, sig, TEST_SECRET)).toBe(false);
  });

  it("should return false when a wrong secret is used", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateUpserveSignature(TEST_PAYLOAD, sig, "upserve_old_key")).toBe(
      false,
    );
  });

  it("should throw for an empty signature (length mismatch)", () => {
    expect(() =>
      validateUpserveSignature(TEST_PAYLOAD, "", TEST_SECRET),
    ).toThrow();
  });
});

// ── SICOM ────────────────────────────────────────────────────────────────────

describe("validateSicomSignature", () => {
  it("should accept a valid hex signature", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateSicomSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true);
  });

  it("should return false for an invalid signature (same-length hex)", () => {
    const wrongSig = hmacHex("different-payload-for-sicom", TEST_SECRET);
    expect(validateSicomSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(
      false,
    );
  });

  it("should return false for a tampered payload", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    const tampered = TEST_PAYLOAD.replace("store_abc", "store_sicom_hack");
    expect(validateSicomSignature(tampered, sig, TEST_SECRET)).toBe(false);
  });

  it("should return false when a wrong secret is used", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(
      validateSicomSignature(TEST_PAYLOAD, sig, "sicom_leaked_secret"),
    ).toBe(false);
  });

  it("should throw for an empty signature (length mismatch)", () => {
    expect(() =>
      validateSicomSignature(TEST_PAYLOAD, "", TEST_SECRET),
    ).toThrow();
  });
});

// ── POSitouch ────────────────────────────────────────────────────────────────

describe("validatePosiTouchSignature", () => {
  it("should accept a valid hex signature", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validatePosiTouchSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(
      true,
    );
  });

  it("should return false for an invalid signature (same-length hex)", () => {
    const wrongSig = hmacHex("different-payload-for-positouch", TEST_SECRET);
    expect(
      validatePosiTouchSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET),
    ).toBe(false);
  });

  it("should return false for a tampered payload", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    const tampered = TEST_PAYLOAD.replace("order_123", "order_positouch");
    expect(validatePosiTouchSignature(tampered, sig, TEST_SECRET)).toBe(false);
  });

  it("should return false when a wrong secret is used", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(
      validatePosiTouchSignature(TEST_PAYLOAD, sig, "positouch_wrong"),
    ).toBe(false);
  });

  it("should throw for an empty signature (length mismatch)", () => {
    expect(() =>
      validatePosiTouchSignature(TEST_PAYLOAD, "", TEST_SECRET),
    ).toThrow();
  });
});

// ── Harbortouch ──────────────────────────────────────────────────────────────

describe("validateHarbortouchSignature", () => {
  it("should accept a valid hex signature", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateHarbortouchSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(
      true,
    );
  });

  it("should return false for an invalid signature (same-length hex)", () => {
    const wrongSig = hmacHex("different-payload-for-harbortouch", TEST_SECRET);
    expect(
      validateHarbortouchSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET),
    ).toBe(false);
  });

  it("should return false for a tampered payload", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    const tampered = TEST_PAYLOAD.replace("merchant_id", "bad_merchant");
    expect(validateHarbortouchSignature(tampered, sig, TEST_SECRET)).toBe(
      false,
    );
  });

  it("should return false when a wrong secret is used", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(
      validateHarbortouchSignature(TEST_PAYLOAD, sig, "harbor_expired"),
    ).toBe(false);
  });

  it("should throw for an empty signature (length mismatch)", () => {
    expect(() =>
      validateHarbortouchSignature(TEST_PAYLOAD, "", TEST_SECRET),
    ).toThrow();
  });
});

// ── Digital Dining ───────────────────────────────────────────────────────────

describe("validateDigitalDiningSignature", () => {
  it("should accept a valid hex signature", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateDigitalDiningSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(
      true,
    );
  });

  it("should return false for an invalid signature (same-length hex)", () => {
    const wrongSig = hmacHex(
      "different-payload-for-digital-dining",
      TEST_SECRET,
    );
    expect(
      validateDigitalDiningSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET),
    ).toBe(false);
  });

  it("should return false for a tampered payload", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    const tampered = TEST_PAYLOAD.replace("2499", "5000");
    expect(validateDigitalDiningSignature(tampered, sig, TEST_SECRET)).toBe(
      false,
    );
  });

  it("should return false when a wrong secret is used", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(
      validateDigitalDiningSignature(TEST_PAYLOAD, sig, "dd_bad_secret"),
    ).toBe(false);
  });

  it("should throw for an empty signature (length mismatch)", () => {
    expect(() =>
      validateDigitalDiningSignature(TEST_PAYLOAD, "", TEST_SECRET),
    ).toThrow();
  });
});

// ── Maitre'D ─────────────────────────────────────────────────────────────────

describe("validateMaitredSignature", () => {
  it("should accept a valid hex signature", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateMaitredSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(true);
  });

  it("should return false for an invalid signature (same-length hex)", () => {
    const wrongSig = hmacHex("different-payload-for-maitred", TEST_SECRET);
    expect(validateMaitredSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET)).toBe(
      false,
    );
  });

  it("should return false for a tampered payload", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    const tampered = TEST_PAYLOAD.replace(
      "payment.completed",
      "payment.disputed",
    );
    expect(validateMaitredSignature(tampered, sig, TEST_SECRET)).toBe(false);
  });

  it("should return false when a wrong secret is used", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateMaitredSignature(TEST_PAYLOAD, sig, "maitred_revoked")).toBe(
      false,
    );
  });

  it("should throw for an empty signature (length mismatch)", () => {
    expect(() =>
      validateMaitredSignature(TEST_PAYLOAD, "", TEST_SECRET),
    ).toThrow();
  });
});

// ── Speedline ────────────────────────────────────────────────────────────────

describe("validateSpeedlineSignature", () => {
  it("should accept a valid hex signature", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(validateSpeedlineSignature(TEST_PAYLOAD, sig, TEST_SECRET)).toBe(
      true,
    );
  });

  it("should return false for an invalid signature (same-length hex)", () => {
    const wrongSig = hmacHex("different-payload-for-speedline", TEST_SECRET);
    expect(
      validateSpeedlineSignature(TEST_PAYLOAD, wrongSig, TEST_SECRET),
    ).toBe(false);
  });

  it("should return false for a tampered payload", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    const tampered = TEST_PAYLOAD.replace(
      "store_abc",
      "store_speedline_tamper",
    );
    expect(validateSpeedlineSignature(tampered, sig, TEST_SECRET)).toBe(false);
  });

  it("should return false when a wrong secret is used", () => {
    const sig = hmacHex(TEST_PAYLOAD, TEST_SECRET);
    expect(
      validateSpeedlineSignature(TEST_PAYLOAD, sig, "speedline_old_key"),
    ).toBe(false);
  });

  it("should throw for an empty signature (length mismatch)", () => {
    expect(() =>
      validateSpeedlineSignature(TEST_PAYLOAD, "", TEST_SECRET),
    ).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2: Adapter normalizeEvent Functions
// ═══════════════════════════════════════════════════════════════════════════════

// ── PAR Brink ────────────────────────────────────────────────────────────────

describe("parBrinkAdapter.normalizeEvent", () => {
  it("should normalize a valid sale event", () => {
    const result = parBrinkAdapter.normalizeEvent({
      orderId: "PB-001",
      lineItems: [
        { itemId: "item_1", name: "Burger", qty: 2, unitPrice: 1299 },
      ],
      total: 2598,
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("PB-001");
    expect(result!.event_type).toBe("sale");
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].pos_item_id).toBe("item_1");
    expect(result!.items[0].quantity).toBe(2);
    expect(result!.items[0].unit_price).toBe(12.99);
    expect(result!.total_amount).toBe(25.98);
    expect(result!.currency).toBe("USD");
  });

  it("should return null for missing order ID", () => {
    expect(parBrinkAdapter.normalizeEvent({ lineItems: [] })).toBeNull();
  });

  it("should return null for empty payload", () => {
    expect(parBrinkAdapter.normalizeEvent({})).toBeNull();
  });

  it("should detect refund events", () => {
    const result = parBrinkAdapter.normalizeEvent({
      orderId: "PB-002",
      type: "refund",
      lineItems: [],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.event_type).toBe("refund");
  });

  it("should use fallback order ID field", () => {
    const result = parBrinkAdapter.normalizeEvent({
      id: "PB-FALLBACK",
      lineItems: [{ id: "item_x", name: "Test", quantity: 1 }],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("PB-FALLBACK");
  });
});

// ── Heartland ────────────────────────────────────────────────────────────────

describe("heartlandAdapter.normalizeEvent", () => {
  it("should normalize a valid sale event", () => {
    const result = heartlandAdapter.normalizeEvent({
      transactionId: "HL-001",
      items: [{ productId: "prod_1", name: "Steak", quantity: 1, price: 2499 }],
      total: 2499,
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("HL-001");
    expect(result!.event_type).toBe("sale");
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].pos_item_id).toBe("prod_1");
    expect(result!.items[0].quantity).toBe(1);
    expect(result!.items[0].unit_price).toBe(24.99);
    expect(result!.total_amount).toBe(24.99);
    expect(result!.currency).toBe("USD");
  });

  it("should return null for missing transaction ID", () => {
    expect(heartlandAdapter.normalizeEvent({ items: [] })).toBeNull();
  });

  it("should return null for empty payload", () => {
    expect(heartlandAdapter.normalizeEvent({})).toBeNull();
  });

  it("should detect refund events", () => {
    const result = heartlandAdapter.normalizeEvent({
      transactionId: "HL-002",
      type: "refund",
      items: [],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.event_type).toBe("refund");
  });

  it("should use fallback order_id field", () => {
    const result = heartlandAdapter.normalizeEvent({
      order_id: "HL-FALLBACK",
      items: [{ id: "item_x", name: "Test", quantity: 1 }],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("HL-FALLBACK");
  });
});

// ── HungerRush ───────────────────────────────────────────────────────────────

describe("hungerRushAdapter.normalizeEvent", () => {
  it("should normalize a valid sale event", () => {
    const result = hungerRushAdapter.normalizeEvent({
      orderId: "HR-001",
      orderItems: [
        {
          itemId: "pizza_1",
          itemName: "Pepperoni Pizza",
          qty: 2,
          unitPrice: 1499,
        },
      ],
      total: 2998,
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("HR-001");
    expect(result!.event_type).toBe("sale");
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].pos_item_id).toBe("pizza_1");
    expect(result!.items[0].pos_item_name).toBe("Pepperoni Pizza");
    expect(result!.items[0].quantity).toBe(2);
    expect(result!.items[0].unit_price).toBe(14.99);
    expect(result!.total_amount).toBe(29.98);
    expect(result!.currency).toBe("USD");
  });

  it("should return null for missing order ID", () => {
    expect(hungerRushAdapter.normalizeEvent({ orderItems: [] })).toBeNull();
  });

  it("should return null for empty payload", () => {
    expect(hungerRushAdapter.normalizeEvent({})).toBeNull();
  });

  it("should detect refund events", () => {
    const result = hungerRushAdapter.normalizeEvent({
      orderId: "HR-002",
      type: "refund",
      orderItems: [],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.event_type).toBe("refund");
  });

  it("should use fallback id field", () => {
    const result = hungerRushAdapter.normalizeEvent({
      id: "HR-FALLBACK",
      items: [{ id: "item_x", name: "Wings", quantity: 3 }],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("HR-FALLBACK");
  });
});

// ── CAKE ─────────────────────────────────────────────────────────────────────

describe("cakeAdapter.normalizeEvent", () => {
  it("should normalize a valid sale event", () => {
    const result = cakeAdapter.normalizeEvent({
      orderId: "CK-001",
      lineItems: [
        { itemId: "ck_1", name: "Ribeye Steak", quantity: 1, price: 3499 },
      ],
      total: 3499,
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("CK-001");
    expect(result!.event_type).toBe("sale");
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].pos_item_id).toBe("ck_1");
    expect(result!.items[0].pos_item_name).toBe("Ribeye Steak");
    expect(result!.items[0].quantity).toBe(1);
    expect(result!.items[0].unit_price).toBe(34.99);
    expect(result!.total_amount).toBe(34.99);
    expect(result!.currency).toBe("USD");
  });

  it("should return null for missing order ID", () => {
    expect(cakeAdapter.normalizeEvent({ lineItems: [] })).toBeNull();
  });

  it("should return null for empty payload", () => {
    expect(cakeAdapter.normalizeEvent({})).toBeNull();
  });

  it("should detect refund events", () => {
    const result = cakeAdapter.normalizeEvent({
      orderId: "CK-002",
      type: "refund",
      lineItems: [],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.event_type).toBe("refund");
  });

  it("should use fallback id field", () => {
    const result = cakeAdapter.normalizeEvent({
      id: "CK-FALLBACK",
      items: [{ id: "item_x", name: "Salad", quantity: 2 }],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("CK-FALLBACK");
  });
});

// ── Lavu ─────────────────────────────────────────────────────────────────────

describe("lavuAdapter.normalizeEvent", () => {
  it("should normalize a valid sale event", () => {
    const result = lavuAdapter.normalizeEvent({
      order_id: "LV-001",
      items: [
        { item_id: "lv_1", item_name: "Margarita", quantity: 3, price: 899 },
      ],
      total: 2697,
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("LV-001");
    expect(result!.event_type).toBe("sale");
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].pos_item_id).toBe("lv_1");
    expect(result!.items[0].pos_item_name).toBe("Margarita");
    expect(result!.items[0].quantity).toBe(3);
    expect(result!.items[0].unit_price).toBe(8.99);
    expect(result!.total_amount).toBe(26.97);
    expect(result!.currency).toBe("USD");
  });

  it("should return null for missing order ID", () => {
    expect(lavuAdapter.normalizeEvent({ items: [] })).toBeNull();
  });

  it("should return null for empty payload", () => {
    expect(lavuAdapter.normalizeEvent({})).toBeNull();
  });

  it("should detect refund events", () => {
    const result = lavuAdapter.normalizeEvent({
      order_id: "LV-002",
      type: "refund",
      items: [],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.event_type).toBe("refund");
  });

  it("should use fallback orderId field", () => {
    const result = lavuAdapter.normalizeEvent({
      orderId: "LV-FALLBACK",
      items: [{ id: "item_x", name: "Beer", quantity: 1 }],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("LV-FALLBACK");
  });
});

// ── Focus POS ────────────────────────────────────────────────────────────────

describe("focusPosAdapter.normalizeEvent", () => {
  it("should normalize a valid sale event", () => {
    const result = focusPosAdapter.normalizeEvent({
      orderId: "FP-001",
      items: [
        { itemId: "fp_1", name: "Filet Mignon", quantity: 1, price: 4999 },
      ],
      total: 4999,
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("FP-001");
    expect(result!.event_type).toBe("sale");
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].pos_item_id).toBe("fp_1");
    expect(result!.items[0].pos_item_name).toBe("Filet Mignon");
    expect(result!.items[0].quantity).toBe(1);
    expect(result!.items[0].unit_price).toBe(49.99);
    expect(result!.total_amount).toBe(49.99);
    expect(result!.currency).toBe("USD");
  });

  it("should return null for missing order ID", () => {
    expect(focusPosAdapter.normalizeEvent({ items: [] })).toBeNull();
  });

  it("should return null for empty payload", () => {
    expect(focusPosAdapter.normalizeEvent({})).toBeNull();
  });

  it("should detect refund events", () => {
    const result = focusPosAdapter.normalizeEvent({
      orderId: "FP-002",
      type: "refund",
      items: [],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.event_type).toBe("refund");
  });

  it("should use fallback id field", () => {
    const result = focusPosAdapter.normalizeEvent({
      id: "FP-FALLBACK",
      lineItems: [{ id: "item_x", name: "Soup", quantity: 1 }],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("FP-FALLBACK");
  });
});

// ── Shopify POS ──────────────────────────────────────────────────────────────

describe("shopifyPosAdapter.normalizeEvent", () => {
  it("should normalize a valid sale event", () => {
    const result = shopifyPosAdapter.normalizeEvent({
      id: "SH-001",
      line_items: [
        { product_id: "sp_1", title: "Craft Beer", quantity: 4, price: 8.5 },
      ],
      total_price: 34.0,
      currency: "USD",
      created_at: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("SH-001");
    expect(result!.event_type).toBe("sale");
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].pos_item_id).toBe("sp_1");
    expect(result!.items[0].pos_item_name).toBe("Craft Beer");
    expect(result!.items[0].quantity).toBe(4);
    expect(result!.items[0].unit_price).toBe(8.5);
    expect(result!.total_amount).toBe(34.0);
    expect(result!.currency).toBe("USD");
  });

  it("should return null for missing order ID", () => {
    expect(shopifyPosAdapter.normalizeEvent({ line_items: [] })).toBeNull();
  });

  it("should return null for empty payload", () => {
    expect(shopifyPosAdapter.normalizeEvent({})).toBeNull();
  });

  it("should detect refund events via financial_status", () => {
    const result = shopifyPosAdapter.normalizeEvent({
      id: "SH-002",
      financial_status: "refunded",
      line_items: [],
      created_at: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.event_type).toBe("refund");
  });

  it("should use fallback order_id field", () => {
    const result = shopifyPosAdapter.normalizeEvent({
      order_id: "SH-FALLBACK",
      line_items: [{ id: "item_x", title: "Coffee", quantity: 1 }],
      created_at: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("SH-FALLBACK");
  });

  it("should default currency to USD when not provided", () => {
    const result = shopifyPosAdapter.normalizeEvent({
      id: "SH-NO-CURR",
      line_items: [],
      created_at: "2026-01-15T12:00:00Z",
    });
    expect(result!.currency).toBe("USD");
  });
});

// ── Aldelo Express ───────────────────────────────────────────────────────────

describe("aldeloExpressAdapter.normalizeEvent", () => {
  it("should normalize a valid sale event", () => {
    const result = aldeloExpressAdapter.normalizeEvent({
      orderId: "AE-001",
      items: [
        { itemId: "ae_1", name: "Chicken Wings", quantity: 2, price: 1299 },
      ],
      total: 2598,
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("AE-001");
    expect(result!.event_type).toBe("sale");
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].pos_item_id).toBe("ae_1");
    expect(result!.items[0].pos_item_name).toBe("Chicken Wings");
    expect(result!.items[0].quantity).toBe(2);
    expect(result!.items[0].unit_price).toBe(12.99);
    expect(result!.total_amount).toBe(25.98);
    expect(result!.currency).toBe("USD");
  });

  it("should return null for missing order ID", () => {
    expect(aldeloExpressAdapter.normalizeEvent({ items: [] })).toBeNull();
  });

  it("should return null for empty payload", () => {
    expect(aldeloExpressAdapter.normalizeEvent({})).toBeNull();
  });

  it("should detect refund events", () => {
    const result = aldeloExpressAdapter.normalizeEvent({
      orderId: "AE-002",
      type: "refund",
      items: [],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.event_type).toBe("refund");
  });

  it("should use fallback id field", () => {
    const result = aldeloExpressAdapter.normalizeEvent({
      id: "AE-FALLBACK",
      lineItems: [{ id: "item_x", name: "Nachos", quantity: 1 }],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("AE-FALLBACK");
  });
});

// ── Squirrel Systems ─────────────────────────────────────────────────────────

describe("squirrelAdapter.normalizeEvent", () => {
  it("should normalize a valid sale event", () => {
    const result = squirrelAdapter.normalizeEvent({
      orderId: "SQ-001",
      items: [
        { itemId: "sq_1", name: "Lobster Tail", quantity: 1, price: 4599 },
      ],
      total: 4599,
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("SQ-001");
    expect(result!.event_type).toBe("sale");
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].pos_item_id).toBe("sq_1");
    expect(result!.items[0].pos_item_name).toBe("Lobster Tail");
    expect(result!.items[0].quantity).toBe(1);
    expect(result!.items[0].unit_price).toBe(45.99);
    expect(result!.total_amount).toBe(45.99);
    expect(result!.currency).toBe("USD");
  });

  it("should return null for missing order ID", () => {
    expect(squirrelAdapter.normalizeEvent({ items: [] })).toBeNull();
  });

  it("should return null for empty payload", () => {
    expect(squirrelAdapter.normalizeEvent({})).toBeNull();
  });

  it("should detect refund events", () => {
    const result = squirrelAdapter.normalizeEvent({
      orderId: "SQ-002",
      type: "refund",
      items: [],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.event_type).toBe("refund");
  });

  it("should use fallback id field", () => {
    const result = squirrelAdapter.normalizeEvent({
      id: "SQ-FALLBACK",
      lineItems: [{ id: "item_x", name: "Calamari", quantity: 1 }],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("SQ-FALLBACK");
  });
});

// ── GoTab ────────────────────────────────────────────────────────────────────

describe("goTabAdapter.normalizeEvent", () => {
  it("should normalize a valid sale event", () => {
    const result = goTabAdapter.normalizeEvent({
      orderId: "GT-001",
      lineItems: [
        { itemId: "gt_1", name: "IPA Pint", quantity: 3, price: 799 },
      ],
      total: 2397,
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("GT-001");
    expect(result!.event_type).toBe("sale");
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].pos_item_id).toBe("gt_1");
    expect(result!.items[0].pos_item_name).toBe("IPA Pint");
    expect(result!.items[0].quantity).toBe(3);
    expect(result!.items[0].unit_price).toBe(7.99);
    expect(result!.total_amount).toBe(23.97);
    expect(result!.currency).toBe("USD");
  });

  it("should return null for missing order ID", () => {
    expect(goTabAdapter.normalizeEvent({ lineItems: [] })).toBeNull();
  });

  it("should return null for empty payload", () => {
    expect(goTabAdapter.normalizeEvent({})).toBeNull();
  });

  it("should detect refund events", () => {
    const result = goTabAdapter.normalizeEvent({
      orderId: "GT-002",
      type: "refund",
      lineItems: [],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.event_type).toBe("refund");
  });

  it("should use fallback id field", () => {
    const result = goTabAdapter.normalizeEvent({
      id: "GT-FALLBACK",
      items: [{ id: "item_x", name: "Lager", quantity: 1 }],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("GT-FALLBACK");
  });
});

// ── Xenial ───────────────────────────────────────────────────────────────────

describe("xenialAdapter.normalizeEvent", () => {
  it("should normalize a valid sale event", () => {
    const result = xenialAdapter.normalizeEvent({
      orderId: "XN-001",
      items: [{ itemId: "xn_1", name: "Combo Meal", quantity: 2, price: 1199 }],
      total: 2398,
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("XN-001");
    expect(result!.event_type).toBe("sale");
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].pos_item_id).toBe("xn_1");
    expect(result!.items[0].pos_item_name).toBe("Combo Meal");
    expect(result!.items[0].quantity).toBe(2);
    expect(result!.items[0].unit_price).toBe(11.99);
    expect(result!.total_amount).toBe(23.98);
    expect(result!.currency).toBe("USD");
  });

  it("should return null for missing order ID", () => {
    expect(xenialAdapter.normalizeEvent({ items: [] })).toBeNull();
  });

  it("should return null for empty payload", () => {
    expect(xenialAdapter.normalizeEvent({})).toBeNull();
  });

  it("should detect refund events", () => {
    const result = xenialAdapter.normalizeEvent({
      orderId: "XN-002",
      type: "refund",
      items: [],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.event_type).toBe("refund");
  });

  it("should use fallback id field", () => {
    const result = xenialAdapter.normalizeEvent({
      id: "XN-FALLBACK",
      lineItems: [{ id: "item_x", name: "Fries", quantity: 1 }],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("XN-FALLBACK");
  });
});

// ── Qu POS ───────────────────────────────────────────────────────────────────

describe("quPosAdapter.normalizeEvent", () => {
  it("should normalize a valid sale event", () => {
    const result = quPosAdapter.normalizeEvent({
      orderId: "QU-001",
      items: [
        { itemId: "qu_1", name: "Chicken Sandwich", quantity: 3, price: 999 },
      ],
      total: 2997,
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("QU-001");
    expect(result!.event_type).toBe("sale");
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].pos_item_id).toBe("qu_1");
    expect(result!.items[0].pos_item_name).toBe("Chicken Sandwich");
    expect(result!.items[0].quantity).toBe(3);
    expect(result!.items[0].unit_price).toBe(9.99);
    expect(result!.total_amount).toBe(29.97);
    expect(result!.currency).toBe("USD");
  });

  it("should return null for missing order ID", () => {
    expect(quPosAdapter.normalizeEvent({ items: [] })).toBeNull();
  });

  it("should return null for empty payload", () => {
    expect(quPosAdapter.normalizeEvent({})).toBeNull();
  });

  it("should detect refund events", () => {
    const result = quPosAdapter.normalizeEvent({
      orderId: "QU-002",
      type: "refund",
      items: [],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.event_type).toBe("refund");
  });

  it("should use fallback id field", () => {
    const result = quPosAdapter.normalizeEvent({
      id: "QU-FALLBACK",
      lineItems: [{ id: "item_x", name: "Milkshake", quantity: 1 }],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("QU-FALLBACK");
  });
});

// ── Future POS ───────────────────────────────────────────────────────────────

describe("futurePosAdapter.normalizeEvent", () => {
  it("should normalize a valid sale event", () => {
    const result = futurePosAdapter.normalizeEvent({
      orderId: "FU-001",
      items: [
        { itemId: "fu_1", name: "Craft Cocktail", quantity: 2, price: 1499 },
      ],
      total: 2998,
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("FU-001");
    expect(result!.event_type).toBe("sale");
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].pos_item_id).toBe("fu_1");
    expect(result!.items[0].pos_item_name).toBe("Craft Cocktail");
    expect(result!.items[0].quantity).toBe(2);
    expect(result!.items[0].unit_price).toBe(14.99);
    expect(result!.total_amount).toBe(29.98);
    expect(result!.currency).toBe("USD");
  });

  it("should return null for missing order ID", () => {
    expect(futurePosAdapter.normalizeEvent({ items: [] })).toBeNull();
  });

  it("should return null for empty payload", () => {
    expect(futurePosAdapter.normalizeEvent({})).toBeNull();
  });

  it("should detect refund events", () => {
    const result = futurePosAdapter.normalizeEvent({
      orderId: "FU-002",
      type: "refund",
      items: [],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.event_type).toBe("refund");
  });

  it("should use fallback id field", () => {
    const result = futurePosAdapter.normalizeEvent({
      id: "FU-FALLBACK",
      lineItems: [{ id: "item_x", name: "Whiskey Sour", quantity: 1 }],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("FU-FALLBACK");
  });
});

// ── Upserve ──────────────────────────────────────────────────────────────────

describe("upserveAdapter.normalizeEvent", () => {
  it("should normalize a valid sale event", () => {
    const result = upserveAdapter.normalizeEvent({
      orderId: "UP-001",
      items: [
        { itemId: "up_1", name: "Grilled Salmon", quantity: 1, price: 2899 },
      ],
      total: 2899,
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("UP-001");
    expect(result!.event_type).toBe("sale");
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].pos_item_id).toBe("up_1");
    expect(result!.items[0].pos_item_name).toBe("Grilled Salmon");
    expect(result!.items[0].quantity).toBe(1);
    expect(result!.items[0].unit_price).toBe(28.99);
    expect(result!.total_amount).toBe(28.99);
    expect(result!.currency).toBe("USD");
  });

  it("should return null for missing order ID", () => {
    expect(upserveAdapter.normalizeEvent({ items: [] })).toBeNull();
  });

  it("should return null for empty payload", () => {
    expect(upserveAdapter.normalizeEvent({})).toBeNull();
  });

  it("should detect refund events", () => {
    const result = upserveAdapter.normalizeEvent({
      orderId: "UP-002",
      type: "refund",
      items: [],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.event_type).toBe("refund");
  });

  it("should use fallback id field", () => {
    const result = upserveAdapter.normalizeEvent({
      id: "UP-FALLBACK",
      lineItems: [{ id: "item_x", name: "Caesar Salad", quantity: 1 }],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("UP-FALLBACK");
  });
});

// ── SICOM ────────────────────────────────────────────────────────────────────

describe("sicomAdapter.normalizeEvent", () => {
  it("should normalize a valid sale event", () => {
    const result = sicomAdapter.normalizeEvent({
      orderId: "SC-001",
      items: [
        { itemId: "sc_1", name: "Value Meal #3", quantity: 4, price: 899 },
      ],
      total: 3596,
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("SC-001");
    expect(result!.event_type).toBe("sale");
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].pos_item_id).toBe("sc_1");
    expect(result!.items[0].pos_item_name).toBe("Value Meal #3");
    expect(result!.items[0].quantity).toBe(4);
    expect(result!.items[0].unit_price).toBe(8.99);
    expect(result!.total_amount).toBe(35.96);
    expect(result!.currency).toBe("USD");
  });

  it("should return null for missing order ID", () => {
    expect(sicomAdapter.normalizeEvent({ items: [] })).toBeNull();
  });

  it("should return null for empty payload", () => {
    expect(sicomAdapter.normalizeEvent({})).toBeNull();
  });

  it("should detect refund events", () => {
    const result = sicomAdapter.normalizeEvent({
      orderId: "SC-002",
      type: "refund",
      items: [],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.event_type).toBe("refund");
  });

  it("should use fallback id field", () => {
    const result = sicomAdapter.normalizeEvent({
      id: "SC-FALLBACK",
      lineItems: [{ id: "item_x", name: "Nuggets", quantity: 1 }],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("SC-FALLBACK");
  });
});

// ── POSitouch ────────────────────────────────────────────────────────────────

describe("posiTouchAdapter.normalizeEvent", () => {
  it("should normalize a valid sale event", () => {
    const result = posiTouchAdapter.normalizeEvent({
      orderId: "PT-001",
      items: [{ itemId: "pt_1", name: "Prime Rib", quantity: 1, price: 3999 }],
      total: 3999,
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("PT-001");
    expect(result!.event_type).toBe("sale");
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].pos_item_id).toBe("pt_1");
    expect(result!.items[0].pos_item_name).toBe("Prime Rib");
    expect(result!.items[0].quantity).toBe(1);
    expect(result!.items[0].unit_price).toBe(39.99);
    expect(result!.total_amount).toBe(39.99);
    expect(result!.currency).toBe("USD");
  });

  it("should return null for missing order ID", () => {
    expect(posiTouchAdapter.normalizeEvent({ items: [] })).toBeNull();
  });

  it("should return null for empty payload", () => {
    expect(posiTouchAdapter.normalizeEvent({})).toBeNull();
  });

  it("should detect refund events", () => {
    const result = posiTouchAdapter.normalizeEvent({
      orderId: "PT-002",
      type: "refund",
      items: [],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.event_type).toBe("refund");
  });

  it("should use fallback id field", () => {
    const result = posiTouchAdapter.normalizeEvent({
      id: "PT-FALLBACK",
      lineItems: [{ id: "item_x", name: "Appetizer", quantity: 1 }],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("PT-FALLBACK");
  });
});

// ── Harbortouch ──────────────────────────────────────────────────────────────

describe("harbortouchAdapter.normalizeEvent", () => {
  it("should normalize a valid sale event", () => {
    const result = harbortouchAdapter.normalizeEvent({
      orderId: "HT-001",
      items: [{ itemId: "ht_1", name: "Fish Tacos", quantity: 2, price: 1399 }],
      total: 2798,
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("HT-001");
    expect(result!.event_type).toBe("sale");
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].pos_item_id).toBe("ht_1");
    expect(result!.items[0].pos_item_name).toBe("Fish Tacos");
    expect(result!.items[0].quantity).toBe(2);
    expect(result!.items[0].unit_price).toBe(13.99);
    expect(result!.total_amount).toBe(27.98);
    expect(result!.currency).toBe("USD");
  });

  it("should return null for missing order ID", () => {
    expect(harbortouchAdapter.normalizeEvent({ items: [] })).toBeNull();
  });

  it("should return null for empty payload", () => {
    expect(harbortouchAdapter.normalizeEvent({})).toBeNull();
  });

  it("should detect refund events", () => {
    const result = harbortouchAdapter.normalizeEvent({
      orderId: "HT-002",
      type: "refund",
      items: [],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.event_type).toBe("refund");
  });

  it("should use fallback id field", () => {
    const result = harbortouchAdapter.normalizeEvent({
      id: "HT-FALLBACK",
      lineItems: [{ id: "item_x", name: "Burrito", quantity: 1 }],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("HT-FALLBACK");
  });
});

// ── Digital Dining ───────────────────────────────────────────────────────────

describe("digitalDiningAdapter.normalizeEvent", () => {
  it("should normalize a valid sale event", () => {
    const result = digitalDiningAdapter.normalizeEvent({
      orderId: "DD-001",
      items: [
        { itemId: "dd_1", name: "Surf and Turf", quantity: 1, price: 5999 },
      ],
      total: 5999,
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("DD-001");
    expect(result!.event_type).toBe("sale");
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].pos_item_id).toBe("dd_1");
    expect(result!.items[0].pos_item_name).toBe("Surf and Turf");
    expect(result!.items[0].quantity).toBe(1);
    expect(result!.items[0].unit_price).toBe(59.99);
    expect(result!.total_amount).toBe(59.99);
    expect(result!.currency).toBe("USD");
  });

  it("should return null for missing order ID", () => {
    expect(digitalDiningAdapter.normalizeEvent({ items: [] })).toBeNull();
  });

  it("should return null for empty payload", () => {
    expect(digitalDiningAdapter.normalizeEvent({})).toBeNull();
  });

  it("should detect refund events", () => {
    const result = digitalDiningAdapter.normalizeEvent({
      orderId: "DD-002",
      type: "refund",
      items: [],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.event_type).toBe("refund");
  });

  it("should use fallback id field", () => {
    const result = digitalDiningAdapter.normalizeEvent({
      id: "DD-FALLBACK",
      lineItems: [{ id: "item_x", name: "Dessert", quantity: 1 }],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("DD-FALLBACK");
  });
});

// ── Maitre'D ─────────────────────────────────────────────────────────────────

describe("maitredAdapter.normalizeEvent", () => {
  it("should normalize a valid sale event", () => {
    const result = maitredAdapter.normalizeEvent({
      orderId: "MD-001",
      items: [
        { itemId: "md_1", name: "Duck Confit", quantity: 1, price: 3299 },
      ],
      total: 3299,
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("MD-001");
    expect(result!.event_type).toBe("sale");
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].pos_item_id).toBe("md_1");
    expect(result!.items[0].pos_item_name).toBe("Duck Confit");
    expect(result!.items[0].quantity).toBe(1);
    expect(result!.items[0].unit_price).toBe(32.99);
    expect(result!.total_amount).toBe(32.99);
    expect(result!.currency).toBe("USD");
  });

  it("should return null for missing order ID", () => {
    expect(maitredAdapter.normalizeEvent({ items: [] })).toBeNull();
  });

  it("should return null for empty payload", () => {
    expect(maitredAdapter.normalizeEvent({})).toBeNull();
  });

  it("should detect refund events", () => {
    const result = maitredAdapter.normalizeEvent({
      orderId: "MD-002",
      type: "refund",
      items: [],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.event_type).toBe("refund");
  });

  it("should use fallback id field", () => {
    const result = maitredAdapter.normalizeEvent({
      id: "MD-FALLBACK",
      lineItems: [{ id: "item_x", name: "Escargot", quantity: 1 }],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("MD-FALLBACK");
  });
});

// ── Speedline ────────────────────────────────────────────────────────────────

describe("speedlineAdapter.normalizeEvent", () => {
  it("should normalize a valid sale event", () => {
    const result = speedlineAdapter.normalizeEvent({
      orderId: "SL-001",
      items: [
        { itemId: "sl_1", name: "Large Pepperoni", quantity: 2, price: 1899 },
      ],
      total: 3798,
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("SL-001");
    expect(result!.event_type).toBe("sale");
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].pos_item_id).toBe("sl_1");
    expect(result!.items[0].pos_item_name).toBe("Large Pepperoni");
    expect(result!.items[0].quantity).toBe(2);
    expect(result!.items[0].unit_price).toBe(18.99);
    expect(result!.total_amount).toBe(37.98);
    expect(result!.currency).toBe("USD");
  });

  it("should return null for missing order ID", () => {
    expect(speedlineAdapter.normalizeEvent({ items: [] })).toBeNull();
  });

  it("should return null for empty payload", () => {
    expect(speedlineAdapter.normalizeEvent({})).toBeNull();
  });

  it("should detect refund events", () => {
    const result = speedlineAdapter.normalizeEvent({
      orderId: "SL-002",
      type: "refund",
      items: [],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.event_type).toBe("refund");
  });

  it("should use fallback id field", () => {
    const result = speedlineAdapter.normalizeEvent({
      id: "SL-FALLBACK",
      lineItems: [{ id: "item_x", name: "Garlic Bread", quantity: 1 }],
      createdAt: "2026-01-15T12:00:00Z",
    });
    expect(result).not.toBeNull();
    expect(result!.external_event_id).toBe("SL-FALLBACK");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3: Adapter Metadata
// ═══════════════════════════════════════════════════════════════════════════════

describe("US POS adapter metadata", () => {
  const adapters = [
    { adapter: parBrinkAdapter, provider: "par_brink", name: "PAR Brink POS" },
    {
      adapter: heartlandAdapter,
      provider: "heartland",
      name: "Heartland Restaurant",
    },
    { adapter: hungerRushAdapter, provider: "hungerrush", name: "HungerRush" },
    { adapter: cakeAdapter, provider: "cake", name: "CAKE by Mad Mobile" },
    { adapter: lavuAdapter, provider: "lavu", name: "Lavu" },
    { adapter: focusPosAdapter, provider: "focus_pos", name: "Focus POS" },
    {
      adapter: shopifyPosAdapter,
      provider: "shopify_pos",
      name: "Shopify POS",
    },
    {
      adapter: aldeloExpressAdapter,
      provider: "aldelo_express",
      name: "Aldelo Express",
    },
    {
      adapter: squirrelAdapter,
      provider: "squirrel",
      name: "Squirrel Systems",
    },
    { adapter: goTabAdapter, provider: "gotab", name: "GoTab" },
    { adapter: xenialAdapter, provider: "xenial", name: "Xenial" },
    { adapter: quPosAdapter, provider: "qu_pos", name: "Qu POS" },
    { adapter: futurePosAdapter, provider: "future_pos", name: "Future POS" },
    { adapter: upserveAdapter, provider: "upserve", name: "Upserve" },
    { adapter: sicomAdapter, provider: "sicom", name: "SICOM" },
    { adapter: posiTouchAdapter, provider: "positouch", name: "POSitouch" },
    {
      adapter: harbortouchAdapter,
      provider: "harbortouch",
      name: "Harbortouch (Shift4)",
    },
    {
      adapter: digitalDiningAdapter,
      provider: "digital_dining",
      name: "Digital Dining",
    },
    { adapter: maitredAdapter, provider: "maitred", name: "Maitre'D" },
    { adapter: speedlineAdapter, provider: "speedline", name: "Speedline" },
  ];

  adapters.forEach(({ adapter, provider, name }) => {
    it(`${name} should have correct provider key`, () => {
      expect(adapter.provider).toBe(provider);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4: fetchMenuItems
// ═══════════════════════════════════════════════════════════════════════════════

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function mockFetchOk(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  });
}

function mockFetchError(status: number) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({}),
  });
}

// ── API-key adapters fetchMenuItems ──────────────────────────────────────────

const apiKeyAdapters = [
  {
    adapter: parBrinkAdapter,
    name: "PAR Brink POS",
    url: "https://api.brinkpos.net/v1/menu/items",
    errorMsg: "PAR Brink POS menu fetch failed: 401",
  },
  {
    adapter: heartlandAdapter,
    name: "Heartland Restaurant",
    url: "https://api.heartlandpaymentsystems.com/v1/menu/items",
    errorMsg: "Heartland Restaurant menu fetch failed: 401",
  },
  {
    adapter: hungerRushAdapter,
    name: "HungerRush",
    url: "https://api.hungerrush.com/v1/menu/items",
    errorMsg: "HungerRush menu fetch failed: 401",
  },
  {
    adapter: lavuAdapter,
    name: "Lavu",
    url: "https://api.lavu.com/v1/menu/items",
    errorMsg: "Lavu menu fetch failed: 401",
  },
  {
    adapter: focusPosAdapter,
    name: "Focus POS",
    url: "https://api.focuspos.com/v1/menu/items",
    errorMsg: "Focus POS menu fetch failed: 401",
  },
  {
    adapter: aldeloExpressAdapter,
    name: "Aldelo Express",
    url: "https://api.aldeloexpress.com/v1/menu/items",
    errorMsg: "Aldelo Express menu fetch failed: 401",
  },
  {
    adapter: squirrelAdapter,
    name: "Squirrel Systems",
    url: "https://api.squirrelsystems.com/v1/menu/items",
    errorMsg: "Squirrel Systems menu fetch failed: 401",
  },
  {
    adapter: xenialAdapter,
    name: "Xenial",
    url: "https://api.xenial.com/v1/menu/items",
    errorMsg: "Xenial menu fetch failed: 401",
  },
  {
    adapter: quPosAdapter,
    name: "Qu POS",
    url: "https://api.qupos.com/v1/menu/items",
    errorMsg: "Qu POS menu fetch failed: 401",
  },
  {
    adapter: futurePosAdapter,
    name: "Future POS",
    url: "https://api.futurepos.com/v1/menu/items",
    errorMsg: "Future POS menu fetch failed: 401",
  },
  {
    adapter: sicomAdapter,
    name: "SICOM",
    url: "https://api.sicom.com/v1/menu/items",
    errorMsg: "SICOM menu fetch failed: 401",
  },
  {
    adapter: posiTouchAdapter,
    name: "POSitouch",
    url: "https://api.positouch.com/v1/menu/items",
    errorMsg: "POSitouch menu fetch failed: 401",
  },
  {
    adapter: harbortouchAdapter,
    name: "Harbortouch",
    url: "https://api.harbortouch.com/v1/menu/items",
    errorMsg: "Harbortouch menu fetch failed: 401",
  },
  {
    adapter: digitalDiningAdapter,
    name: "Digital Dining",
    url: "https://api.digitaldining.com/v1/menu/items",
    errorMsg: "Digital Dining menu fetch failed: 401",
  },
  {
    adapter: maitredAdapter,
    name: "Maitre'D",
    url: "https://api.maitredpos.com/v1/menu/items",
    errorMsg: "Maitre'D menu fetch failed: 401",
  },
  {
    adapter: speedlineAdapter,
    name: "Speedline",
    url: "https://api.speedlinesolutions.com/v1/menu/items",
    errorMsg: "Speedline menu fetch failed: 401",
  },
] as const;

describe("API-key adapters fetchMenuItems", () => {
  apiKeyAdapters.forEach(({ adapter, name, url, errorMsg }) => {
    describe(`${name}`, () => {
      const credentials = { api_key: "test_api_key_123" };

      it("should return mapped menu items on success", async () => {
        mockFetchOk({
          items: [
            { id: "m1", name: "Burger", category: "Entrees", price: 1299 },
            { id: "m2", name: "Fries", category: "Sides", price: 499 },
          ],
        });
        const result = await adapter.fetchMenuItems!(credentials);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
          pos_item_id: "m1",
          pos_item_name: "Burger",
          category: "Entrees",
          price: 12.99,
          currency: "USD",
        });
        expect(result[1]).toEqual({
          pos_item_id: "m2",
          pos_item_name: "Fries",
          category: "Sides",
          price: 4.99,
          currency: "USD",
        });
        expect(mockFetch).toHaveBeenCalledWith(url, {
          headers: {
            Authorization: "Bearer test_api_key_123",
            Accept: "application/json",
          },
        });
      });

      it("should return empty array when no items", async () => {
        mockFetchOk({ items: [] });
        const result = await adapter.fetchMenuItems!(credentials);
        expect(result).toEqual([]);
      });

      it("should throw on API error", async () => {
        mockFetchError(401);
        await expect(adapter.fetchMenuItems!(credentials)).rejects.toThrow(
          errorMsg,
        );
      });
    });
  });
});

// ── OAuth adapters fetchMenuItems (CAKE, GoTab, Upserve) ─────────────────────

const oauthAdapters = [
  {
    adapter: cakeAdapter,
    name: "CAKE",
    url: "https://api.thecake.com/v1/menu/items",
    errorMsg: "CAKE menu fetch failed: 403",
    categoryField: "categoryName",
  },
  {
    adapter: goTabAdapter,
    name: "GoTab",
    url: "https://api.gotab.io/v1/menu/items",
    errorMsg: "GoTab menu fetch failed: 403",
    categoryField: "category",
  },
  {
    adapter: upserveAdapter,
    name: "Upserve",
    url: "https://api.upserve.com/v1/menu/items",
    errorMsg: "Upserve menu fetch failed: 403",
    categoryField: "category",
  },
] as const;

describe("OAuth adapters fetchMenuItems", () => {
  oauthAdapters.forEach(({ adapter, name, url, errorMsg, categoryField }) => {
    describe(`${name}`, () => {
      const credentials = { access_token: "oauth_token_abc" };

      it("should return mapped menu items on success", async () => {
        mockFetchOk({
          items: [
            { id: "o1", name: "Pasta", [categoryField]: "Mains", price: 1799 },
          ],
        });
        const result = await adapter.fetchMenuItems!(credentials);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
          pos_item_id: "o1",
          pos_item_name: "Pasta",
          category: "Mains",
          price: 17.99,
          currency: "USD",
        });
        expect(mockFetch).toHaveBeenCalledWith(url, {
          headers: {
            Authorization: "Bearer oauth_token_abc",
            Accept: "application/json",
          },
        });
      });

      it("should return empty array when no items", async () => {
        mockFetchOk({ items: [] });
        const result = await adapter.fetchMenuItems!(credentials);
        expect(result).toEqual([]);
      });

      it("should throw on API error", async () => {
        mockFetchError(403);
        await expect(adapter.fetchMenuItems!(credentials)).rejects.toThrow(
          errorMsg,
        );
      });
    });
  });
});

// ── Shopify POS fetchMenuItems (unique pattern) ──────────────────────────────

describe("shopifyPosAdapter.fetchMenuItems", () => {
  const credentials = {
    shop_domain: "testshop",
    access_token: "shpat_abc123",
  };

  it("should return mapped products on success", async () => {
    mockFetchOk({
      products: [
        {
          id: "prod_1",
          title: "Espresso",
          product_type: "Beverages",
          variants: [{ price: "4.50" }],
        },
        {
          id: "prod_2",
          title: "Muffin",
          product_type: "Bakery",
          variants: [{ price: "3.25" }],
        },
      ],
    });
    const result = await shopifyPosAdapter.fetchMenuItems!(credentials);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      pos_item_id: "prod_1",
      pos_item_name: "Espresso",
      category: "Beverages",
      price: 4.5,
      currency: "USD",
    });
    expect(result[1]).toEqual({
      pos_item_id: "prod_2",
      pos_item_name: "Muffin",
      category: "Bakery",
      price: 3.25,
      currency: "USD",
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://testshop.myshopify.com/admin/api/2024-01/products.json",
      {
        headers: {
          "X-Shopify-Access-Token": "shpat_abc123",
          Accept: "application/json",
        },
      },
    );
  });

  it("should return empty array when no products", async () => {
    mockFetchOk({ products: [] });
    const result = await shopifyPosAdapter.fetchMenuItems!(credentials);
    expect(result).toEqual([]);
  });

  it("should throw on API error", async () => {
    mockFetchError(401);
    await expect(
      shopifyPosAdapter.fetchMenuItems!(credentials),
    ).rejects.toThrow("Shopify POS products fetch failed: 401");
  });
});
