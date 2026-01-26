import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { trainingApi } from '@/integrations/aws/api';
import { trainingCourses, Course, Question } from '@/data/trainingCourses';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, BookOpen, Clock, Award, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Learning() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showCourseContent, setShowCourseContent] = useState(false);
  const [showExam, setShowExam] = useState(false);
  const [examAnswers, setExamAnswers] = useState<Record<string, string>>({});

  // Fetch training progress
  const { data: progress, isLoading } = useQuery({
    queryKey: ['training-progress'],
    queryFn: async () => {
      const result = await trainingApi.getProgress();
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
  });

  // Submit exam mutation
  const submitExamMutation = useMutation({
    mutationFn: async ({ courseId, answers }: { courseId: string; answers: Record<string, string> }) => {
      const result = await trainingApi.submitExam({ course_id: courseId, answers });
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['training-progress'] });
      
      if (data.passed) {
        toast.success('Congratulations!', {
          description: `You passed with a score of ${data.score}%! ${data.training_completed ? 'All training completed! You can now access the dashboard.' : ''}`,
        });
        
        if (data.training_completed) {
          setTimeout(() => {
            navigate('/dashboard');
          }, 2000);
        }
      } else {
        toast.error('Exam Failed', {
          description: `You scored ${data.score}%. You need 80% to pass. Please review the material and try again.`,
        });
      }
      
      setShowExam(false);
      setExamAnswers({});
      setSelectedCourse(null);
    },
    onError: (error: Error) => {
      toast.error('Failed to submit exam', {
        description: error.message,
      });
    },
  });

  const getCourseProgress = (courseId: string) => {
    return progress?.courses.find(c => c.course_id === courseId);
  };

  const handleStartCourse = (course: Course) => {
    setSelectedCourse(course);
    setShowCourseContent(true);
  };

  const handleStartExam = () => {
    setShowCourseContent(false);
    setShowExam(true);
    setExamAnswers({});
  };

  const handleExamAnswer = (questionId: string, answer: string) => {
    setExamAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmitExam = () => {
    if (!selectedCourse) return;
    
    const allAnswered = selectedCourse.exam.every(q => examAnswers[q.id]);
    if (!allAnswered) {
      toast.error('Please answer all questions before submitting');
      return;
    }

    submitExamMutation.mutate({
      courseId: selectedCourse.id,
      answers: examAnswers,
    });
  };

  const completedCourses = progress?.courses.filter(c => c.exam_passed).length || 0;
  const totalCourses = trainingCourses.length;
  const progressPercent = (completedCourses / totalCourses) * 100;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Training Dashboard</h1>
          <p className="text-muted-foreground">
            Complete all training courses to unlock full access to your dashboard
          </p>
        </div>

        {/* Overall Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Your Progress
            </CardTitle>
            <CardDescription>
              {completedCourses} of {totalCourses} courses completed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={progressPercent} className="h-2" />
            <p className="mt-2 text-sm text-muted-foreground">
              {progress?.training_completed
                ? '✅ All training completed! You can now access your dashboard.'
                : `${totalCourses - completedCourses} course${totalCourses - completedCourses !== 1 ? 's' : ''} remaining`}
            </p>
          </CardContent>
          {progress?.training_completed && (
            <CardFooter>
              <Button onClick={() => navigate('/dashboard')} className="w-full">
                Go to Dashboard
              </Button>
            </CardFooter>
          )}
        </Card>

        {/* Courses Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {trainingCourses.map((course) => {
            const courseProgress = getCourseProgress(course.id);
            const isPassed = courseProgress?.exam_passed || false;
            const score = courseProgress?.exam_score;

            return (
              <Card key={course.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="text-4xl">{course.icon}</div>
                    {isPassed && <CheckCircle2 className="h-6 w-6 text-green-600" />}
                  </div>
                  <CardTitle className="text-xl">{course.title}</CardTitle>
                  <CardDescription>{course.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {course.duration}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BookOpen className="h-4 w-4" />
                    {course.exam.length} exam questions
                  </div>
                  {score !== undefined && score !== null && (
                    <div className="pt-2">
                      <Badge variant={isPassed ? 'default' : 'destructive'}>
                        Last Score: {score}%
                      </Badge>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={() => handleStartCourse(course)}
                    variant={isPassed ? 'outline' : 'default'}
                    className="w-full"
                  >
                    {isPassed ? 'Review Course' : 'Start Course'}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* Course Content Modal */}
        <Dialog open={showCourseContent} onOpenChange={setShowCourseContent}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {selectedCourse?.icon} {selectedCourse?.title}
              </DialogTitle>
              <DialogDescription>{selectedCourse?.description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {selectedCourse?.content.map((section, idx) => (
                <div key={idx} className="space-y-3">
                  <h3 className="text-lg font-semibold text-foreground">{section.section}</h3>
                  <ul className="space-y-2 pl-6">
                    {section.items.map((item, itemIdx) => (
                      <li key={itemIdx} className="text-sm text-muted-foreground list-disc">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCourseContent(false)}>
                Close
              </Button>
              <Button onClick={handleStartExam}>Take Exam</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Exam Modal */}
        <Dialog open={showExam} onOpenChange={setShowExam}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {selectedCourse?.title} - Exam
              </DialogTitle>
              <DialogDescription>
                You need 80% or higher to pass. Answer all questions and submit when ready.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {selectedCourse?.exam.map((question, idx) => (
                <div key={question.id} className="space-y-3">
                  <h3 className="font-semibold text-foreground">
                    {idx + 1}. {question.text}
                  </h3>
                  <RadioGroup
                    value={examAnswers[question.id] || ''}
                    onValueChange={(value) => handleExamAnswer(question.id, value)}
                  >
                    {question.options.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={option.value} id={`${question.id}-${option.value}`} />
                        <Label htmlFor={`${question.id}-${option.value}`} className="cursor-pointer">
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowExam(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSubmitExam}
                disabled={submitExamMutation.isPending}
              >
                {submitExamMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Exam'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
