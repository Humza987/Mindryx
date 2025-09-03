"use client";

import { useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";

// Move the publishable key here - it needs to be available at build time
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

export default function CheckoutPage() {
  useEffect(() => {
    async function initializeCheckout() {
      try {
        const stripe = await stripePromise;

        if (!stripe) {
          console.error("Stripe failed to load");
          return;
        }

        const fetchClientSecret = async () => {
          try {
            const res = await fetch("/api/checkout", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
            });

            if (!res.ok) {
              throw new Error(`HTTP error! status: ${res.status}`);
            }

            const data = await res.json();

            if (data.error) {
              throw new Error(data.error);
            }

            // Make sure we're returning the client_secret as a string
            return data.client_secret;
          } catch (error) {
            console.error("Error fetching client secret:", error);
            throw error;
          }
        };

        const checkout = await stripe.initEmbeddedCheckout({
          fetchClientSecret,
        });

        checkout.mount("#checkout");
      } catch (error) {
        console.error("Error initializing checkout:", error);
      }
    }

    initializeCheckout();
  }, []);

  return (
    <div>
      <h1>Checkout</h1>
      <div id="checkout"></div>
    </div>
  );
}
