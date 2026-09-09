import { createStripeRuntime } from "./stripe-runtime";

function config(values: Record<string, string | undefined>) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as never;
}

describe("Stripe runtime safety", () => {
  it("leaves Stripe disabled when no server secret is configured", () => {
    expect(createStripeRuntime(config({}))).toEqual({
      client: null,
      liveMode: null,
    });
  });

  it("allows test credentials without a live-mode opt in", () => {
    const runtime = createStripeRuntime(
      config({ STRIPE_SECRET_KEY: "sk_test_example" }),
    );

    expect(runtime.client).not.toBeNull();
    expect(runtime.liveMode).toBe(false);
  });

  it("rejects live credentials outside an explicitly enabled production run", () => {
    expect(() =>
      createStripeRuntime(
        config({
          NODE_ENV: "development",
          STRIPE_LIVE_MODE_ENABLED: "true",
          STRIPE_SECRET_KEY: "sk_live_example",
        }),
      ),
    ).toThrow("Live Stripe credentials are disabled");

    expect(() =>
      createStripeRuntime(
        config({
          NODE_ENV: "production",
          STRIPE_LIVE_MODE_ENABLED: "false",
          STRIPE_SECRET_KEY: "sk_live_example",
        }),
      ),
    ).toThrow("Live Stripe credentials are disabled");
  });
});
