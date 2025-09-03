"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useSession } from "@clerk/nextjs";

type SupabaseContextType = {
  supabase: SupabaseClient | null;
  isLoaded: boolean;
};

const SupabaseContext = createContext<SupabaseContextType>({
  supabase: null,
  isLoaded: false,
});

type Props = { children: React.ReactNode };

export default function SupabaseProvider({ children }: Props) {
  const { session } = useSession();
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // env checks (fail early)
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    if (typeof window !== "undefined") {
      // only log client-side to avoid server noise
      console.warn(
        "[SupabaseProvider] Missing NEXT_PUBLIC_SUPABASE_* env vars"
      );
    }
  }

  useEffect(() => {
    // create a client instance using custom fetch with Clerk integration
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error(
        "[SupabaseProvider] Cannot create Supabase client - missing environment variables"
      );
      return;
    }

    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        // Use custom fetch function to include Clerk token
        fetch: async (url, options = {}) => {
          const token = await session?.getToken();
          
          console.log(
            "Token being used:",
            token ? token.substring(0, 50) + "..." : "No token"
          );

          const headers = {
            ...options.headers,
            ...(token && { Authorization: `Bearer ${token}` }),
          };

          return fetch(url, {
            ...options,
            headers,
          });
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    setSupabase(client);
    setIsLoaded(true);

    return () => {
      // optional cleanup; supabase-js doesn't expose explicit dispose
      setSupabase(null);
      setIsLoaded(false);
    };
    // re-create when session changes
  }, [SUPABASE_URL, SUPABASE_ANON_KEY, session]);

  const contextValue = useMemo(
    () => ({
      supabase,
      isLoaded,
    }),
    [supabase, isLoaded]
  );

  return (
    <SupabaseContext.Provider value={contextValue}>
      {!isLoaded ? (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Initializing...</p>
          </div>
        </div>
      ) : (
        children
      )}
    </SupabaseContext.Provider>
  );
}

export const useSupabase = () => {
  const ctx = useContext(SupabaseContext);
  if (!ctx) {
    throw new Error("useSupabase must be used within SupabaseProvider");
  }
  return ctx;
};