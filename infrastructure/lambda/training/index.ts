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

  // Define required courses
  const requiredCourses = ['roofing-basics', 'sales-techniques', 'safety-protocols'];
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
  // Define correct answers for each course
  const correctAnswers: Record<string, Record<string, any>> = {
    'roofing-basics': {
      'q1': 'b', // Asphalt shingles
      'q2': 'c', // Ice and water shield
      'q3': 'a', // Safety first
      'q4': 'b', // 20-30 years
      'q5': 'c', // Proper ventilation

    },
    'sales-techniques': {
      'q1': 'b', // Ask open-ended questions
      'q2': 'c', // Address concerns
      'q3': 'a', // Build rapport first
      'q4': 'b', // Benefits not features
      'q5': 'a', // Follow up consistently
    },
    'safety-protocols': {
      'q1': 'a', // Always wear PPE
      'q2': 'c', // Inspect before use
      'q3': 'b', // Three points of contact
      'q4': 'a', // Stop work immediately
      'q5': 'c', // OSHA standards
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
