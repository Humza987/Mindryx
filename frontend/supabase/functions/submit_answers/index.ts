// // supabase/functions/submit_quiz/index.ts
// import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// import { jwtVerify, createRemoteJWKSet } from "https://esm.sh/jose@4";
// const corsHeaders = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Headers": "Authorization, Content-Type",
//   "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
// };
// // Clerk issuer + JWKS
// const ISSUER = env("CLERK_ISSUER");
// const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks.json`));
// function env(name) {
//   return Deno.env.get(name) ?? "";
// }
// serve(async (req) => {
//   if (req.method === "OPTIONS") {
//     return new Response("ok", {
//       headers: corsHeaders,
//     });
//   }
//   try {
//     // 1️⃣ Extract and verify Clerk token
//     const authHeader = req.headers.get("Authorization") || "";
//     if (!authHeader.startsWith("Bearer "))
//       throw new Error("Missing Bearer token");
//     const token = authHeader.replace("Bearer ", "");
//     const { payload } = await jwtVerify(token, JWKS, {
//       issuer: ISSUER,
//     });
//     const clerkUserId = payload.sub;
//     // 2️⃣ Parse request body
//     const body = await req.json().catch(() => ({}));
//     const { quizId, answers } = body;
//     // 3️⃣ Initialize Supabase
//     const supabase = createClient(
//       env("SUPABASE_URL"),
//       env("SUPABASE_SERVICE_ROLE_KEY")
//     );
//     // 4️⃣ Fetch quiz by ID
//     const { data: quizData, error: quizErr } = await supabase
//       .from("quizzes")
//       .select("quiz")
//       .eq("id", quizId)
//       .single();
//     if (quizErr || !quizData) {
//       return new Response(
//         JSON.stringify({
//           error: "Quiz not found",
//         }),
//         {
//           status: 404,
//           headers: {
//             ...corsHeaders,
//             "Content-Type": "application/json",
//           },
//         }
//       );
//     }
//     const questions = quizData.quiz;
//     let score = 0;
//     const answersArray = Object.keys(answers)
//       .sort((a, b) => parseInt(a) - parseInt(b))
//       .map((k) => answers[k]);
//     questions.forEach((q, i) => {
//       const correct = q.options.find((o) => o.correct)?.id;
//       if (answersArray[i] === correct) score++;
//     });
//     const total = questions.length;
//     const percentage = Math.round((score / total) * 100 * 100) / 100;
//     // 5️⃣ Insert result
//     const { error: resultErr } = await supabase.from("results").insert({
//       user_id: clerkUserId,
//       quiz_id: quizId,
//       answers: answersArray,
//       score,
//       total_questions: total,
//       percentage,
//     });
//     if (resultErr) {
//       return new Response(
//         JSON.stringify({
//           error: resultErr.message,
//         }),
//         {
//           status: 500,
//           headers: {
//             ...corsHeaders,
//             "Content-Type": "application/json",
//           },
//         }
//       );
//     }
//     return new Response(
//       JSON.stringify({
//         score,
//         totalQuestions: total,
//         percentage,
//       }),
//       {
//         status: 200,
//         headers: {
//           ...corsHeaders,
//           "Content-Type": "application/json",
//         },
//       }
//     );
//   } catch (err) {
//     console.error("[edge] error:", err);
//     return new Response(
//       JSON.stringify({
//         error: "Unauthorized or internal error",
//         detail: String(err),
//       }),
//       {
//         status: 401,
//         headers: {
//           ...corsHeaders,
//           "Content-Type": "application/json",
//         },
//       }
//     );
//   }
// });
