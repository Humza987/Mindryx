"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ReturnPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // Fix: Allow string or null

  useEffect(() => {
    async function getSessionStatus() {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get("session_id");

      if (!sessionId) {
        setError("No session ID found in URL. Redirecting to homepage...");
        setTimeout(() => router.push("/"), 3000);
        return;
      }

      try {
        const endpoint = `/api/session-status?session_id=${sessionId}`;
        const res = await fetch(endpoint);

        if (!res.ok) {
          throw new Error(
            `Error fetching session: ${res.status} ${res.statusText}`
          );
        }

        const data = await res.json();
        setSession(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error occurred");
      } finally {
        setLoading(false);
      }
    }

    getSessionStatus();
  }, [router]);

  const handleReturnToCheckout = () => {
    router.push("/");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <p className="text-lg mb-4">Loading payment status...</p>
        <div className="w-8 h-8 border-4 border-t-blue-500 border-b-gray-200 border-l-gray-200 border-r-gray-200 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-lg mx-auto my-8">
        <h2 className="text-red-700 text-xl font-semibold mb-3">
          Payment Error
        </h2>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={handleReturnToCheckout}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition duration-150"
        >
          Return to checkout
        </button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-lg mx-auto my-8">
        <h2 className="text-yellow-700 text-xl font-semibold mb-3">
          Session Not Found
        </h2>
        <p className="text-yellow-600 mb-4">
          No session information was found. Please try your purchase again.
        </p>
        <button
          onClick={handleReturnToCheckout}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition duration-150"
        >
          Return to checkout
        </button>
      </div>
    );
  }

  if (session.status === "complete") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 max-w-lg mx-auto my-8">
        <h2 className="text-green-700 text-xl font-semibold mb-3">
          Payment Successful!
        </h2>
        {session.customer_email ? (
          <p className="text-green-600 mb-4">
            Thank you for your purchase! A confirmation email has been sent to{" "}
            <strong>{session.customer_email}</strong>.
          </p>
        ) : (
          <p className="text-green-600 mb-4">
            Thank you for your purchase! Your payment has been processed
            successfully.
          </p>
        )}
        <button
          onClick={() => router.push("/")}
          className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-md transition duration-150"
        >
          Continue shopping
        </button>
      </div>
    );
  } else {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-lg mx-auto my-8">
        <h2 className="text-yellow-700 text-xl font-semibold mb-3">
          Payment Not Completed
        </h2>
        <p className="text-yellow-600 mb-4">
          Your payment was not completed. Status: {session.status}
        </p>
        <button
          onClick={handleReturnToCheckout}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md transition duration-150"
        >
          Return to checkout
        </button>
      </div>
    );
  }
}