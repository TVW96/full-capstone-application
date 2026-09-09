import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";

export type StripeRuntime = {
  client: Stripe | null;
  liveMode: boolean | null;
};

export function createStripeRuntime(config: ConfigService): StripeRuntime {
  const secretKey = config.get<string>("STRIPE_SECRET_KEY")?.trim();
  if (!secretKey) return { client: null, liveMode: null };

  const liveMode = /^(?:sk|rk)_live_/.test(secretKey);
  if (
    liveMode &&
    (config.get<string>("NODE_ENV") !== "production" ||
      config.get<string>("STRIPE_LIVE_MODE_ENABLED")?.trim().toLowerCase() !==
        "true")
  ) {
    throw new Error(
      "Live Stripe credentials are disabled. Use test mode, or set NODE_ENV=production and explicitly enable STRIPE_LIVE_MODE_ENABLED after launch approval.",
    );
  }

  return { client: new Stripe(secretKey), liveMode };
}
