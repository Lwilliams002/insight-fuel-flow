# Learning Dashboard System

## Overview

The Learning Dashboard is a training system for new reps that locks access to the main dashboard until all required training courses are completed. Reps must pass exams for each course with a score of 80% or higher.

## Architecture

### Database Schema

**New Table: `training_progress`**
- `id` - UUID primary key
- `rep_id` - Foreign key to reps table
- `course_id` - Text identifier for the course
- `exam_score` - Integer (0-100)
- `exam_passed` - Boolean
- `completed_at` - Timestamp when passed
- `created_at` / `updated_at` - Standard timestamps

**Updated Table: `reps`**
- Added `training_completed` - Boolean flag set to true when all courses are passed

### Backend API

**Lambda Function: `/infrastructure/lambda/training/index.ts`**

Endpoints:
- `GET /training` - Get rep's training progress
- `POST /training/submit` - Submit exam answers and get results

The training Lambda:
1. Validates user authentication
2. Fetches or creates training progress records
3. Calculates exam scores based on correct answers
4. Updates the `training_completed` flag on reps table when all required courses pass
5. Returns results with score and pass/fail status

**Required Courses:**
- `roofing-basics` - Fundamentals of roofing systems
- `sales-techniques` - Sales best practices
- `safety-protocols` - Essential safety guidelines

### Frontend Components

**Training Course Data: `/src/data/trainingCourses.ts`**
- Defines 3 comprehensive training courses
- Each course has:
  - Title, description, icon, duration
  - Content sections with learning items
  - 5 multiple-choice exam questions
  - Correct answers defined in backend for scoring

**Learning Page: `/src/pages/Learning.tsx`**
- Main training dashboard interface
- Displays overall progress across all courses
- Course cards showing status (passed/not started)
- Modal dialogs for course content and exams
- Real-time exam submission and results
- Auto-redirects to dashboard when training is complete

**Access Control: `/src/components/ProtectedRoute.tsx`**
- Enhanced to check `training_completed` status for reps
- Redirects untrained reps to `/learning` route
- Uses `skipTrainingCheck` prop to allow access to learning page itself
- Fetches current rep data to check training status

## User Flow

1. **New Rep Creation**
   - Admin creates new rep via `/admin/reps`
   - Rep record created with `training_completed = false`

2. **First Login**
   - Rep signs in and is authenticated
   - ProtectedRoute checks training status
   - Automatically redirected to `/learning` (not `/dashboard`)

3. **Taking Courses**
   - Rep views 3 training courses on learning dashboard
   - Clicks "Start Course" to view content
   - Reads through course material sections
   - Clicks "Take Exam" when ready

4. **Exam Process**
   - 5 multiple-choice questions per exam
   - Must answer all questions before submitting
   - 80% passing grade required (4 out of 5 correct)
   - Instant feedback with score and pass/fail status

5. **Completion**
   - When all 3 exams are passed, `training_completed` flag is set to true
   - "Go to Dashboard" button appears
   - Rep can now access all dashboard features
   - Can still review courses even after passing

## Course Content

### Course 1: Roofing Basics 🏠
- Introduction to Roofing
- Roofing Materials (asphalt, metal, tile)
- Installation Process
- Roof Lifespan & Maintenance
- Duration: 30 minutes

### Course 2: Sales Techniques 💼
- Building Rapport
- Needs Assessment
- Presentation Skills
- Closing the Deal
- Follow-Up Best Practices
- Duration: 45 minutes

### Course 3: Safety Protocols ⚠️
- Personal Protective Equipment (PPE)
- Fall Protection
- Ladder Safety
- Electrical Hazards
- Emergency Procedures
- Duration: 30 minutes

## Deployment

### Database Migration

1. **Deploy init-db Lambda changes:**
```bash
# Ensure init-db Lambda is updated with training tables
# Deploy via AWS Console or infrastructure as code
```

2. **Run init-db endpoint:**
```bash
curl -X POST https://YOUR_API_URL/dev/init-db \
  -H "Authorization: Bearer YOUR_TOKEN"
```

This will:
- Add `training_completed` column to existing reps (defaults to false)
- Create `training_progress` table
- Add necessary indexes

### Lambda Deployment

1. **Deploy training Lambda:**
   - Package: `/infrastructure/lambda/training/`
   - Route: `GET /training`, `POST /training/submit`
   - Requires database access and shared auth utilities

2. **Update API Gateway:**
   - Add `/training` resource
   - Configure CORS
   - Connect to training Lambda

### Frontend Deployment

Already included in the build. No additional steps needed.

## Testing

### Manual Testing Steps

1. **Create Test Rep:**
```bash
# Use admin dashboard to create a new rep
# Email: testrep@example.com
# Password: set by admin
```

2. **Login as Rep:**
   - Should redirect to `/learning` automatically
   - Dashboard should show 0 of 3 courses completed

3. **Complete First Course:**
   - Click "Start Course" on Roofing Basics
   - Review content
   - Take exam
   - Try both passing (80%+) and failing scenarios

4. **Complete All Courses:**
   - Repeat for all 3 courses
   - Progress bar should update after each exam
   - After passing all 3, should see success message

5. **Access Dashboard:**
   - Click "Go to Dashboard" button
   - Should now have full access to all rep features
   - Future logins should go directly to dashboard

## Customization

### Adding New Courses

Edit `/src/data/trainingCourses.ts`:

```typescript
{
  id: 'new-course',
  title: 'New Course Title',
  description: '...',
  icon: '📚',
  duration: '20 minutes',
  content: [
    {
      section: 'Section 1',
      items: ['Item 1', 'Item 2']
    }
  ],
  exam: [
    {
      id: 'q1',
      text: 'Question text?',
      options: [
        { value: 'a', label: 'Option A' },
        { value: 'b', label: 'Option B' }
      ]
    }
  ]
}
```

Update `/infrastructure/lambda/training/index.ts`:
- Add course ID to `requiredCourses` array
- Add correct answers to `correctAnswers` object

### Changing Pass Threshold

In `/infrastructure/lambda/training/index.ts`, change:
```typescript
const passed = score >= 80; // Change 80 to desired percentage
```

### Bypassing Training (for testing)

Manually update database:
```sql
UPDATE reps SET training_completed = true WHERE user_id = 'USER_UUID';
```

## Security Considerations

- Exam answers are never exposed to frontend
- Scoring happens server-side
- Rep can only access their own training progress
- Training status checked on every protected route access
- Cannot bypass training by URL manipulation

## Future Enhancements

Potential improvements:
- Certificate generation upon completion
- Training expiration/renewal requirements
- Progress saving within courses
- Video content support
- Quiz retake limits
- Time tracking per course
- Admin dashboard for training analytics
