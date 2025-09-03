// app/api/getOutstandingQuizzes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { currentUser } from "@clerk/nextjs/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server-only env

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function GET(req: NextRequest) {
  const user = await currentUser();
  const userId = user?.id || null;

  try {
    if (!user || !user.id) {
      console.warn("No user found, retrying once...");
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 1s
      const retryUser = await currentUser();
      if (!retryUser || !retryUser.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    // Get all quizzes for the user that don't have corresponding results
    const { data: quizzesData, error: quizzesError } = await supabase
      .from("quizzes")
      .select("id, topic, difficulty, created_at, user_id")
      .eq("user_id", userId)
      .not("quiz", "is", null); // Only get quizzes that have been generated (quiz field is not null)

    if (quizzesError) {
      return NextResponse.json(
        { error: quizzesError.message },
        { status: 500 }
      );
    }

    if (!quizzesData || quizzesData.length === 0) {
      return NextResponse.json({
        outstandingQuizzes: [],
        count: 0,
        userId,
      });
    }

    // Get quiz IDs that have results (i.e., have been taken)
    const quizIds = quizzesData.map((quiz) => quiz.id);
    const { data: resultsData, error: resultsError } = await supabase
      .from("results")
      .select("quiz_id")
      .in("quiz_id", quizIds);

    if (resultsError) {
      return NextResponse.json(
        { error: resultsError.message },
        { status: 500 }
      );
    }

    // Get the quiz IDs that have been taken
    const takenQuizIds = new Set(
      resultsData?.map((result) => result.quiz_id) || []
    );

    // Filter out quizzes that have been taken
    const outstandingQuizzes = quizzesData
      .filter((quiz) => !takenQuizIds.has(quiz.id))
      .map((quiz) => ({
        quizId: quiz.id,
        topic: quiz.topic,
        difficulty: quiz.difficulty,
        createdAt: quiz.created_at,
      }));

    return NextResponse.json({
      outstandingQuizzes,
      count: outstandingQuizzes.length,
      userId,
    });
  } catch (err) {
    console.error("Error in getOutstandingQuizzes:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
