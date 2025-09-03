// app/api/session-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(request: NextRequest) {
  // Extract the session_id from URL query parameters
  const { searchParams } = new URL(request.url);
  const session_id = searchParams.get("session_id");

  if (!session_id) {
    return NextResponse.json(
      { error: "Missing session_id parameter" },
      { status: 400 }
    );
  }

  try {
    console.log("Retrieving session:", session_id); // Add logging
    const session = await stripe.checkout.sessions.retrieve(session_id);
    console.log("Session retrieved successfully"); // Add logging

    return NextResponse.json({
      status: session.status,
      customer_email: session.customer_details?.email,
    });
  } catch (err: any) {
    console.error("Error retrieving session:", err); // Add logging
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
