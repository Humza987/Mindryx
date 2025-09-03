// app/api/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    // Debug environment variables
    console.log("Environment check:");
    console.log("STRIPE_SECRET_KEY exists:", !!process.env.STRIPE_SECRET_KEY);
    console.log(
      "STRIPE_PRICE_ID exists:",
      !!process.env.NEXT_PUBLIC_STRIPE_PRICE_ID
    );
    console.log("DOMAIN exists:", !!process.env.NEXT_PUBLIC_DOMAIN);
    console.log("Price ID:", process.env.NEXT_PUBLIC_STRIPE_PRICE_ID);
    console.log("Domain:", process.env.NEXT_PUBLIC_DOMAIN);

    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    if (!process.env.NEXT_PUBLIC_STRIPE_PRICE_ID) {
      throw new Error("NEXT_PUBLIC_STRIPE_PRICE_ID is not set");
    }

    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded", // Set ui_mode to embedded
      line_items: [
        {
          price: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: "subscription",
      return_url: `${process.env.NEXT_PUBLIC_DOMAIN}/return?session_id={CHECKOUT_SESSION_ID}`,
      // Remove payment_method_types to use automatic_payment_methods by default
    });

    console.log("Session created successfully:", session.id);

    return NextResponse.json({ client_secret: session.client_secret });
  } catch (error: any) {
    console.error("Stripe checkout session creation failed:", error);
    console.error("Error details:", error.type, error.code, error.param);
    return NextResponse.json(
      {
        error: error?.message || "Failed to create checkout session",
      },
      { status: 500 }
    );
  }
}
