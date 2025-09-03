// app/api/getQuizCount/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { currentUser } from "@clerk/nextjs/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function GET(req: NextRequest) {
  try {
    // Get the authenticated user from Clerk
    const user = await currentUser();

    if (!user || !user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current date for calculating current month
    const currentDate = new Date();

    // Query for current month's stats
    const { data: currentMonthStats, error: currentError } = await supabase
      .from("user_quiz_stats")
      .select("quiz_count, month_start_date")
      .eq("user_id", user.id)
      .lte("month_start_date", currentDate.toISOString().split("T")[0])
      .gte(
        "month_start_date",
        new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0]
      )
      .order("month_start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (currentError) {
      return NextResponse.json(
        { error: currentError.message },
        { status: 500 }
      );
    }

    // Get all-time stats for the user
    const { data: allTimeStats, error: allTimeError } = await supabase
      .from("user_quiz_stats")
      .select("quiz_count")
      .eq("user_id", user.id);

    if (allTimeError) {
      return NextResponse.json(
        { error: allTimeError.message },
        { status: 500 }
      );
    }

    // Calculate totals
    const currentMonthCount = currentMonthStats?.quiz_count || 0;
    const allTimeCount =
      allTimeStats?.reduce((sum, stat) => sum + stat.quiz_count, 0) || 0;

    return NextResponse.json({
      data: {
        currentMonth: {
          count: currentMonthCount,
          monthStart: currentMonthStats?.month_start_date || null,
        },
        allTime: {
          count: allTimeCount,
        },
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Alternative: Get stats for a specific month period
export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { monthStartDate } = await req.json();

    if (!monthStartDate) {
      return NextResponse.json(
        { error: "Missing monthStartDate" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("user_quiz_stats")
      .select("quiz_count, month_start_date")
      .eq("user_id", user.id)
      .eq("month_start_date", monthStartDate)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        count: data?.quiz_count || 0,
        monthStart: data?.month_start_date || null,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
