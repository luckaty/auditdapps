// src/lib/plans.ts

export type PlanKey = "premium_weekly" | "premium_monthly" | "premium_annual";

type PlanDef = {
  label: string;
  priceId: string;
};

export const PLANS: Record<PlanKey, PlanDef> = {
  premium_weekly: {
    label: "Premium Weekly",
    // ⬇️ put your REAL Stripe weekly price id here
    priceId: "price_1Sc5dS3QVQIPS1sHUWnxS3QE",
  },
  premium_monthly: {
    label: "Premium Monthly",
    // ⬇️ put your REAL Stripe monthly price id here
    priceId: "price_1SX9Eh3QVQIPS1sHN5ZeTnk3",
  },
  premium_annual: {
    label: "Premium Annual",
    // ⬇️ put your REAL Stripe annual price id here
    priceId: "price_1SZT9U3QVQIPS1sHVeyyZ60f",
  },
};
