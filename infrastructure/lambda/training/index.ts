import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query, queryOne, execute } from '../shared/database';
import {
  getUserFromEvent,
  success,
  created,
  badRequest,
  forbidden,
  notFound,
  serverError,
  parseBody,
} from '../shared/auth';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const user = getUserFromEvent(event);
  if (!user) {
    return forbidden('Authentication required');
  }

  const method = event.httpMethod;
  const path = event.path;

  try {
    // GET /training - get rep's training progress
    if (method === 'GET' && path.endsWith('/training')) {
      return await getTrainingProgress(user);
    }

    // POST /training/submit - submit exam answers
    if (method === 'POST' && path.endsWith('/training/submit')) {
      return await submitExam(user, event);
    }

    return badRequest('Invalid endpoint');
  } catch (error) {
    console.error('Error:', error);
    return serverError(error instanceof Error ? error.message : 'Unknown error');
  }
}

async function getTrainingProgress(user: any) {
  // Get the rep record for this user
  const rep = await queryOne(
    'SELECT id, training_completed FROM reps WHERE user_id = $1',
    [user.sub]
  );

  if (!rep) {
    return notFound('Rep not found');
  }

  // Get all training progress for this rep
  const progress = await query(
    `SELECT course_id, exam_score, exam_passed, completed_at
     FROM training_progress
     WHERE rep_id = $1
     ORDER BY created_at`,
    [rep.id]
  );

  return success({
    training_completed: rep.training_completed,
    courses: progress,
  });
}

async function submitExam(user: any, event: APIGatewayProxyEvent) {
  const body = parseBody(event);
  if (!body || !body.course_id || !body.answers) {
    return badRequest('course_id and answers required');
  }

  // Get the rep record for this user
  const rep = await queryOne(
    'SELECT id FROM reps WHERE user_id = $1',
    [user.sub]
  );

  if (!rep) {
    return notFound('Rep not found');
  }

  const { course_id, answers } = body;

  // Calculate score based on correct answers
  // This is a simple implementation - answers should be an object with question_id: answer_value
  const score = calculateScore(course_id, answers);
  const passed = score >= 80; // 80% passing grade

  // Insert or update training progress
  const progressRecord = await queryOne(
    `INSERT INTO training_progress (rep_id, course_id, exam_score, exam_passed, completed_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (rep_id, course_id)
     DO UPDATE SET
       exam_score = EXCLUDED.exam_score,
       exam_passed = EXCLUDED.exam_passed,
       completed_at = EXCLUDED.completed_at,
       updated_at = NOW()
     RETURNING *`,
    [rep.id, course_id, score, passed, passed ? new Date().toISOString() : null]
  );

  // Check if all required courses are completed
  const allProgress = await query(
    `SELECT course_id, exam_passed FROM training_progress WHERE rep_id = $1`,
    [rep.id]
  );

  // Define required courses (all 5 must be passed)
  const requiredCourses = [
    'roof-types-components',
    'measuring-estimating',
    'sales-door-knocking',
    'understanding-insurance',
    'job-cycle-adjuster'
  ];
  const allCompleted = requiredCourses.every(courseId =>
    allProgress.some((p: any) => p.course_id === courseId && p.exam_passed)
  );

  // Update rep's training_completed status if all courses passed
  if (allCompleted) {
    await execute(
      'UPDATE reps SET training_completed = true WHERE id = $1',
      [rep.id]
    );
  }

  return success({
    score,
    passed,
    training_completed: allCompleted,
    progress: progressRecord,
  });
}

// Calculate exam score based on correct answers
function calculateScore(courseId: string, answers: Record<string, any>): number {
  // Define correct answers for each course (10 questions each)
  const correctAnswers: Record<string, Record<string, string>> = {
    'roof-types-components': {
      'q1': 'b',  // 100 square feet
      'q2': 'c',  // 15% waste for hip roofs
      'q3': 'c',  // Running parallel to ground where gutters hang
      'q4': 'c',  // Step flashing
      'q5': 'b',  // No, insurance does NOT cover wood rot
      'q6': 'a',  // 10% for gable roofs
      'q7': 'b',  // Hip roof (envelope shape)
      'q8': 'b',  // Where slopes meet to create a V (valley)
      'q9': 'b',  // Divert water around chimney
      'q10': 'c', // 3-Tab is flat, Architectural is 3-dimensional
    },
    'measuring-estimating': {
      'q1': 'b',  // (Base1 + Base2) × Height ÷ 2
      'q2': 'c',  // Divide by 100
      'q3': 'c',  // For difficult, multi-steep, or 3+ story roofs
      'q4': 'c',  // Homeowner's last name, address, and orientation
      'q5': 'a',  // 5.4 squares
      'q6': 'b',  // Base × Height ÷ 2
      'q7': 'b',  // 300 square feet
      'q8': 'b',  // # of panels × panel height in inches ÷ 12
      'q9': 'b',  // Eaves LF, Rakes LF, Ridge/Hip LF, Valley LF, and style
      'q10': 'b', // Do it yourself
    },
    'sales-door-knocking': {
      'q1': 'b',  // Offer TWO specific times to choose from
      'q2': 'b',  // Handling customer objections
      'q3': 'b',  // Setting appointment gives 2 impressions instead of 1
      'q4': 'b',  // 3-4 days
      'q5': 'b',  // Leave on a good note, mention neighbors, give card
      'q6': 'b',  // Sun chews through exposed asphalt
      'q7': 'c',  // SELL - only purpose is to schedule inspection
      'q8': 'b',  // 1.5-2 hours apart
      'q9': 'b',  // Both can make decision together
      'q10': 'b', // Write down appointment on calendar and take phone number
    },
    'understanding-insurance': {
      'q1': 'b',  // Actual Cash Value
      'q2': 'c',  // ACV + Depreciation = RCV
      'q3': 'b',  // After the work is completed and invoiced
      'q4': 'b',  // $6,000 (ACV minus deductible)
      'q5': 'c',  // Insurance will pay only after it has been completed
      'q6': 'b',  // Replacement Cost Policy
      'q7': 'b',  // Fixed out-of-pocket amount homeowner pays
      'q8': 'b',  // Adjuster uses fair market pricing software
      'q9': 'b',  // Carrots >> or asterisks *
      'q10': 'b', // Same fixed deductible regardless of quality
    },
    'job-cycle-adjuster': {
      'q1': 'b',  // Sign, Build, Collect
      'q2': 'b',  // Be cool, friendly, and help make their job easier
      'q3': 'c',  // At least 30 minutes ahead
      'q4': 'b',  // Calmly ask questions, instruct homeowner to request re-inspection
      'q5': 'b',  // Hand over the pen and BE QUIET
      'q6': 'b',  // Xactimate, Diagram/EagleView, agreement copy, business cards
      'q7': 'b',  // 5-7 hits (not the most obvious ones)
      'q8': 'b',  // Call insurance, write claim #, get adjuster info, call you
      'q9': 'b',  // At the kitchen table
      'q10': 'b', // Ask questions about marginal damage
    },
  };

  const correct = correctAnswers[courseId];
  if (!correct) {
    return 0;
  }

  const totalQuestions = Object.keys(correct).length;
  let correctCount = 0;

  for (const [questionId, correctAnswer] of Object.entries(correct)) {
    if (answers[questionId] === correctAnswer) {
      correctCount++;
    }
  }

  return Math.round((correctCount / totalQuestions) * 100);
}
