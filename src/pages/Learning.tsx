import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { trainingApi } from '@/integrations/aws/api';
import { trainingCourses, Course } from '@/data/trainingCourses';
import { useAuth } from '@/contexts/AwsAuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle2,
  BookOpen,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Target,
  Trophy,
  Home,
  Ruler,
  DoorOpen,
  FileText,
  RotateCcw,
  X,
  CheckCircle,
  XCircle,
  AlertCircle,
  Lightbulb,
  LogOut
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function Learning() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'course' | 'exam'>('list');
  const [examAnswers, setExamAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [lastExamResult, setLastExamResult] = useState<{ score: number; passed: boolean } | null>(null);

  // LocalStorage keys for saving progress
  const STORAGE_KEY_COURSE = 'training_current_course';
  const STORAGE_KEY_SECTION = 'training_current_section';
  const STORAGE_KEY_ANSWERS = 'training_exam_answers';
  const STORAGE_KEY_QUESTION = 'training_current_question';

  // Load saved progress on mount
  useEffect(() => {
    const savedCourseId = localStorage.getItem(STORAGE_KEY_COURSE);
    const savedSection = localStorage.getItem(STORAGE_KEY_SECTION);
    const savedAnswers = localStorage.getItem(STORAGE_KEY_ANSWERS);
    const savedQuestion = localStorage.getItem(STORAGE_KEY_QUESTION);

    if (savedCourseId) {
      const course = trainingCourses.find(c => c.id === savedCourseId);
      if (course) {
        setSelectedCourse(course);
        if (savedSection) {
          setCurrentSection(parseInt(savedSection, 10));
        }
        if (savedAnswers) {
          try {
            const answers = JSON.parse(savedAnswers);
            setExamAnswers(answers);
            // If there are saved answers, go to exam mode
            if (Object.keys(answers).length > 0) {
              setViewMode('exam');
              if (savedQuestion) {
                setCurrentQuestionIndex(parseInt(savedQuestion, 10));
              }
            } else {
              setViewMode('course');
            }
          } catch {
            setViewMode('course');
          }
        } else {
          setViewMode('course');
        }
      }
    }
  }, []);

  // Save course progress to localStorage
  useEffect(() => {
    if (selectedCourse) {
      localStorage.setItem(STORAGE_KEY_COURSE, selectedCourse.id);
      localStorage.setItem(STORAGE_KEY_SECTION, currentSection.toString());
    }
  }, [selectedCourse, currentSection]);

  // Save exam answers to localStorage
  useEffect(() => {
    if (selectedCourse && Object.keys(examAnswers).length > 0) {
      localStorage.setItem(STORAGE_KEY_ANSWERS, JSON.stringify(examAnswers));
      localStorage.setItem(STORAGE_KEY_QUESTION, currentQuestionIndex.toString());
    }
  }, [examAnswers, currentQuestionIndex, selectedCourse]);

  // Clear localStorage when returning to list
  const clearSavedProgress = () => {
    localStorage.removeItem(STORAGE_KEY_COURSE);
    localStorage.removeItem(STORAGE_KEY_SECTION);
    localStorage.removeItem(STORAGE_KEY_ANSWERS);
    localStorage.removeItem(STORAGE_KEY_QUESTION);
  };

  // Handle logout
  const handleLogout = async () => {
    clearSavedProgress();
    await signOut();
    navigate('/auth');
  };

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
      // Clear saved exam answers after submission
      localStorage.removeItem(STORAGE_KEY_ANSWERS);
      localStorage.removeItem(STORAGE_KEY_QUESTION);

      queryClient.invalidateQueries({ queryKey: ['training-progress'] });
      setLastExamResult({ score: data.score, passed: data.passed });
      setShowResults(true);

      if (data.passed) {
        // Clear all progress if passed
        clearSavedProgress();
      }

      if (data.training_completed) {
        toast.success('🎉 All Training Completed!', {
          description: 'You now have full access to your dashboard.',
          duration: 5000,
        });
      }
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

  const getCourseIcon = (courseId: string) => {
    const icons: Record<string, React.ReactNode> = {
      'roof-types-components': <Home className="h-6 w-6" />,
      'measuring-estimating': <Ruler className="h-6 w-6" />,
      'sales-door-knocking': <DoorOpen className="h-6 w-6" />,
      'understanding-insurance': <FileText className="h-6 w-6" />,
      'job-cycle-adjuster': <RotateCcw className="h-6 w-6" />,
    };
    return icons[courseId] || <BookOpen className="h-6 w-6" />;
  };

  const handleStartCourse = (course: Course) => {
    setSelectedCourse(course);
    setCurrentSection(0);
    setViewMode('course');
  };

  const handleStartExam = () => {
    setViewMode('exam');
    setExamAnswers({});
    setCurrentQuestionIndex(0);
    setShowResults(false);
    setLastExamResult(null);
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

  const handleBackToList = () => {
    clearSavedProgress();
    setViewMode('list');
    setSelectedCourse(null);
    setCurrentSection(0);
    setExamAnswers({});
    setShowResults(false);
    setLastExamResult(null);
  };

  const handleRetryExam = () => {
    setExamAnswers({});
    setCurrentQuestionIndex(0);
    setShowResults(false);
    setLastExamResult(null);
  };

  const completedCourses = progress?.courses.filter(c => c.exam_passed).length || 0;
  const totalCourses = trainingCourses.length;
  const progressPercent = (completedCourses / totalCourses) * 100;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your training...</p>
        </div>
      </div>
    );
  }

  // Course List View
  if (viewMode === 'list') {
    return (
      <div className="min-h-screen bg-background pb-8">
        {/* Hero Header */}
        <div className="bg-gradient-to-br from-prime-navy to-[#1a2d42] text-white px-4 py-8 sm:py-12">
          <div className="container mx-auto max-w-4xl">
            {/* Header with Logout */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white/10 rounded-xl">
                  <GraduationCap className="h-8 w-8" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold">Training Academy</h1>
                  <p className="text-white/70 text-sm sm:text-base">Master the skills to succeed</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>

            {/* Progress Card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mt-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-prime-gold" />
                  <span className="font-medium">Your Progress</span>
                </div>
                <Badge variant="outline" className="bg-white/10 border-white/20 text-white">
                  {completedCourses}/{totalCourses} Complete
                </Badge>
              </div>
              <Progress value={progressPercent} className="h-3 bg-white/20" />
              <p className="text-sm text-white/70 mt-2">
                {progress?.training_completed
                  ? '🎉 All training completed! You have full access.'
                  : `Complete ${totalCourses - completedCourses} more course${totalCourses - completedCourses !== 1 ? 's' : ''} to unlock your dashboard`}
              </p>
              {progress?.training_completed && (
                <Button
                  onClick={() => navigate('/dashboard')}
                  className="w-full mt-4 bg-prime-gold hover:bg-prime-gold/90 text-prime-navy font-semibold"
                >
                  Go to Dashboard
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Course Cards */}
        <div className="container mx-auto max-w-4xl px-4 -mt-4">
          <div className="space-y-4">
            {trainingCourses.map((course, index) => {
              const courseProgress = getCourseProgress(course.id);
              const isPassed = courseProgress?.exam_passed || false;
              const score = courseProgress?.exam_score;

              return (
                <Card
                  key={course.id}
                  className={cn(
                    "border-2 transition-all duration-200 active:scale-[0.99]",
                    isPassed ? "border-green-500/30 bg-green-500/5" : "border-border hover:border-primary/30"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Course Number & Icon */}
                      <div className={cn(
                        "flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center",
                        isPassed ? "bg-green-500/20 text-green-600" : "bg-primary/10 text-primary"
                      )}>
                        {isPassed ? (
                          <CheckCircle2 className="h-7 w-7" />
                        ) : (
                          <span className="text-2xl font-bold">{index + 1}</span>
                        )}
                      </div>

                      {/* Course Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-foreground leading-tight">{course.title}</h3>
                          {getCourseIcon(course.id)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{course.description}</p>

                        <div className="flex flex-wrap items-center gap-3 mt-3">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {course.duration}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Target className="h-3.5 w-3.5" />
                            {course.exam.length} questions
                          </div>
                          {score !== undefined && score !== null && (
                            <Badge
                              variant={isPassed ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              Score: {score}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleStartCourse(course)}
                      variant={isPassed ? 'outline' : 'default'}
                      className="w-full mt-4"
                    >
                      {isPassed ? 'Review Course' : 'Start Learning'}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Course Content View
  if (viewMode === 'course' && selectedCourse) {
    const section = selectedCourse.content[currentSection];
    const totalSections = selectedCourse.content.length;
    const isLastSection = currentSection === totalSections - 1;

    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border">
          <div className="flex items-center justify-between p-4">
            <button
              onClick={handleBackToList}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Back</span>
            </button>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Section {currentSection + 1} of {totalSections}</p>
              <Progress value={((currentSection + 1) / totalSections) * 100} className="h-1.5 w-24 mt-1" />
            </div>
            <button
              onClick={handleStartExam}
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Take Exam
            </button>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4 pb-32 max-w-2xl mx-auto">
            {/* Section Title */}
            <div className="mb-6">
              <Badge variant="outline" className="mb-2">
                {selectedCourse.title}
              </Badge>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">{section.section}</h2>
            </div>

            {/* Key Concepts Card */}
            <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                <span className="font-semibold text-sm">Key Concepts</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Pay attention to the details below - they will be on the exam!
              </p>
            </div>

            {/* Content Items */}
            <div className="space-y-4">
              {section.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex gap-3 p-4 rounded-xl bg-card border border-border"
                >
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </div>
                  <p className="text-sm sm:text-base text-foreground leading-relaxed">{item}</p>
                </div>
              ))}
            </div>

            {/* Section Summary */}
            <div className="mt-6 p-4 rounded-xl bg-prime-gold/10 border border-prime-gold/30">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-prime-gold flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground text-sm">Remember</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Review all {section.items.length} points before moving to the next section. You'll need to know these for your exam!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="max-w-2xl mx-auto flex gap-3">
            <Button
              variant="outline"
              onClick={() => setCurrentSection(prev => Math.max(0, prev - 1))}
              disabled={currentSection === 0}
              className="flex-1"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            {isLastSection ? (
              <Button onClick={handleStartExam} className="flex-1 bg-prime-gold hover:bg-prime-gold/90 text-prime-navy">
                Take Exam
                <GraduationCap className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={() => setCurrentSection(prev => Math.min(totalSections - 1, prev + 1))}
                className="flex-1"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Exam View
  if (viewMode === 'exam' && selectedCourse) {
    const currentQuestion = selectedCourse.exam[currentQuestionIndex];
    const totalQuestions = selectedCourse.exam.length;
    const answeredCount = Object.keys(examAnswers).length;

    // Results View
    if (showResults && lastExamResult) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md text-center">
            {/* Result Icon */}
            <div className={cn(
              "w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center",
              lastExamResult.passed ? "bg-green-500/20" : "bg-red-500/20"
            )}>
              {lastExamResult.passed ? (
                <CheckCircle className="h-12 w-12 text-green-500" />
              ) : (
                <XCircle className="h-12 w-12 text-red-500" />
              )}
            </div>

            {/* Result Text */}
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {lastExamResult.passed ? 'Congratulations! 🎉' : 'Keep Learning! 📚'}
            </h2>
            <p className="text-muted-foreground mb-6">
              {lastExamResult.passed
                ? 'You\'ve successfully completed this course!'
                : 'Review the material and try again. You need 80% to pass.'}
            </p>

            {/* Score Card */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="text-5xl font-bold text-foreground mb-2">
                  {lastExamResult.score}%
                </div>
                <p className="text-sm text-muted-foreground">
                  {Math.round((lastExamResult.score / 100) * totalQuestions)} of {totalQuestions} correct
                </p>
                <div className="mt-4">
                  <Progress
                    value={lastExamResult.score}
                    className={cn(
                      "h-3",
                      lastExamResult.passed ? "bg-green-500/20" : "bg-red-500/20"
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3">
              {lastExamResult.passed ? (
                <Button onClick={handleBackToList} className="w-full">
                  Continue Training
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <>
                  <Button onClick={() => setViewMode('course')} variant="outline" className="w-full">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Review Material
                  </Button>
                  <Button onClick={handleRetryExam} className="w-full">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retry Exam
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border">
          <div className="flex items-center justify-between p-4">
            <button
              onClick={() => setViewMode('course')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="text-center">
              <p className="text-sm font-medium">Question {currentQuestionIndex + 1} of {totalQuestions}</p>
            </div>
            <Badge variant="outline">
              {answeredCount}/{totalQuestions}
            </Badge>
          </div>
          {/* Question Progress */}
          <div className="flex gap-1 px-4 pb-3">
            {selectedCourse.exam.map((q, idx) => (
              <div
                key={q.id}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  examAnswers[q.id]
                    ? "bg-primary"
                    : idx === currentQuestionIndex
                      ? "bg-primary/50"
                      : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>

        {/* Question Content */}
        <ScrollArea className="flex-1">
          <div className="p-4 pb-32 max-w-2xl mx-auto">
            <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-6 leading-relaxed">
              {currentQuestion.text}
            </h2>

            <RadioGroup
              value={examAnswers[currentQuestion.id] || ''}
              onValueChange={(value) => handleExamAnswer(currentQuestion.id, value)}
              className="space-y-3"
            >
              {currentQuestion.options.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all",
                    examAnswers[currentQuestion.id] === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30 hover:bg-muted/50"
                  )}
                >
                  <RadioGroupItem value={option.value} className="mt-0.5" />
                  <span className="text-sm sm:text-base text-foreground leading-relaxed">
                    {option.label}
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>
        </ScrollArea>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="max-w-2xl mx-auto flex gap-3">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
              disabled={currentQuestionIndex === 0}
              className="flex-1"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            {currentQuestionIndex === totalQuestions - 1 ? (
              <Button
                onClick={handleSubmitExam}
                disabled={submitExamMutation.isPending || answeredCount < totalQuestions}
                className="flex-1 bg-prime-gold hover:bg-prime-gold/90 text-prime-navy"
              >
                {submitExamMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Exam
                    <CheckCircle className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                disabled={!examAnswers[currentQuestion.id]}
                className="flex-1"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
