import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, Modal, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trainingApi, CourseProgress } from '../../src/services/api';
import { trainingCourses, Course, ContentItem } from '../../src/data/trainingCourses';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';

type ViewMode = 'list' | 'course' | 'exam';

const STORAGE_KEY_COURSE = 'training_current_course';
const STORAGE_KEY_SECTION = 'training_current_section';
const STORAGE_KEY_ANSWERS = 'training_exam_answers';
const STORAGE_KEY_QUESTION = 'training_current_question';

const courseIcons: Record<string, string> = {
  'titan-prime-standard': 'shield-checkmark',
  'roof-types-components': 'home',
  'measuring-estimating': 'calculator',
  'sales-door-knocking': 'walk',
  'understanding-insurance': 'document-text',
  'job-cycle-adjuster': 'sync',
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function TrainingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors, isDark } = useTheme();
  const { signOut } = useAuth();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [examAnswers, setExamAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [lastExamResult, setLastExamResult] = useState<{ score: number; passed: boolean } | null>(null);

  // Image viewer state
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [viewerImage, setViewerImage] = useState<number | string | null>(null);
  const [viewerCaption, setViewerCaption] = useState<string | null>(null);

  // Handle logout
  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await clearSavedProgress();
            await signOut();
            router.replace('/');
          },
        },
      ]
    );
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
    onSuccess: async (data) => {
      // Clear saved exam answers after submission
      await AsyncStorage.removeItem(STORAGE_KEY_ANSWERS);
      await AsyncStorage.removeItem(STORAGE_KEY_QUESTION);

      queryClient.invalidateQueries({ queryKey: ['training-progress'] });
      setLastExamResult({ score: data.score, passed: data.passed });
      setShowResults(true);

      if (data.passed) {
        clearSavedProgress();
      }

      if (data.training_completed) {
        // Invalidate rep-me query so layout knows training is complete
        queryClient.invalidateQueries({ queryKey: ['rep-me'] });

        Alert.alert(
          '🎉 All Training Completed!',
          'You now have full access to your dashboard.',
          [{ text: 'Go to Dashboard', onPress: () => router.replace('/(rep)/dashboard') }]
        );
      }
    },
    onError: (error: Error) => {
      Alert.alert('Error', 'Failed to submit exam: ' + error.message);
    },
  });

  // Load saved progress on mount
  useEffect(() => {
    loadSavedProgress();
  }, []);

  // Save course progress
  useEffect(() => {
    if (selectedCourse) {
      AsyncStorage.setItem(STORAGE_KEY_COURSE, selectedCourse.id);
      AsyncStorage.setItem(STORAGE_KEY_SECTION, currentSection.toString());
    }
  }, [selectedCourse, currentSection]);

  // Save exam answers
  useEffect(() => {
    if (selectedCourse && Object.keys(examAnswers).length > 0) {
      AsyncStorage.setItem(STORAGE_KEY_ANSWERS, JSON.stringify(examAnswers));
      AsyncStorage.setItem(STORAGE_KEY_QUESTION, currentQuestionIndex.toString());
    }
  }, [examAnswers, currentQuestionIndex, selectedCourse]);

  const loadSavedProgress = async () => {
    try {
      const savedCourseId = await AsyncStorage.getItem(STORAGE_KEY_COURSE);
      const savedSection = await AsyncStorage.getItem(STORAGE_KEY_SECTION);
      const savedAnswers = await AsyncStorage.getItem(STORAGE_KEY_ANSWERS);
      const savedQuestion = await AsyncStorage.getItem(STORAGE_KEY_QUESTION);

      if (savedCourseId) {
        const course = trainingCourses.find(c => c.id === savedCourseId);
        if (course) {
          setSelectedCourse(course);
          if (savedSection) {
            setCurrentSection(parseInt(savedSection, 10));
          }
          if (savedAnswers) {
            const answers = JSON.parse(savedAnswers);
            setExamAnswers(answers);
            if (Object.keys(answers).length > 0) {
              setViewMode('exam');
              if (savedQuestion) {
                setCurrentQuestionIndex(parseInt(savedQuestion, 10));
              }
            } else {
              setViewMode('course');
            }
          } else {
            setViewMode('course');
          }
        }
      }
    } catch (error) {
      console.error('Error loading saved progress:', error);
    }
  };

  const clearSavedProgress = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY_COURSE);
    await AsyncStorage.removeItem(STORAGE_KEY_SECTION);
    await AsyncStorage.removeItem(STORAGE_KEY_ANSWERS);
    await AsyncStorage.removeItem(STORAGE_KEY_QUESTION);
  };

  const getCourseProgress = (courseId: string): CourseProgress | undefined => {
    return progress?.courses.find(c => c.course_id === courseId);
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
      Alert.alert('Error', 'Please answer all questions before submitting');
      return;
    }

    submitExamMutation.mutate({
      courseId: selectedCourse.id,
      answers: examAnswers,
    });
  };

  const handleBackToList = async () => {
    await clearSavedProgress();
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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading training...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // COURSE LIST VIEW
  if (viewMode === 'list') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.headerTitleSection}>
                <Text style={[styles.title, { color: colors.foreground }]}>Training Center</Text>
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                  Complete all courses to unlock your dashboard
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.logoutButton, { backgroundColor: isDark ? colors.muted : '#FEE2E2' }]}
                onPress={handleLogout}
              >
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Progress Card */}
          <View style={[styles.progressCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF' }]}>
            <View style={styles.progressHeader}>
              <Ionicons name="school" size={24} color={colors.primary} />
              <Text style={[styles.progressTitle, { color: colors.foreground }]}>Your Progress</Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: colors.primary }]} />
              </View>
              <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
                {completedCourses} of {totalCourses} courses completed
              </Text>
            </View>
          </View>

          {/* Course Cards */}
          {trainingCourses.map((course) => {
            const courseProgress = getCourseProgress(course.id);
            const isPassed = courseProgress?.exam_passed || false;
            const score = courseProgress?.exam_score;

            return (
              <TouchableOpacity
                key={course.id}
                style={[
                  styles.courseCard,
                  { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderColor: isPassed ? '#22C55E' : colors.border },
                  isPassed && styles.courseCardPassed,
                ]}
                onPress={() => handleStartCourse(course)}
              >
                <View style={styles.courseCardContent}>
                  <View style={[styles.courseIcon, { backgroundColor: isPassed ? 'rgba(34, 197, 94, 0.1)' : `${colors.primary}1A` }]}>
                    <Ionicons
                      name={(courseIcons[course.id] || 'book') as keyof typeof Ionicons.glyphMap}
                      size={24}
                      color={isPassed ? '#22C55E' : colors.primary}
                    />
                  </View>
                  <View style={styles.courseInfo}>
                    <View style={styles.courseHeader}>
                      <Text style={[styles.courseTitle, { color: colors.foreground }]}>{course.title}</Text>
                      {isPassed && (
                        <View style={styles.passedBadge}>
                          <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                          <Text style={styles.passedText}>{score}%</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.courseDescription, { color: colors.mutedForeground }]} numberOfLines={2}>
                      {course.description}
                    </Text>
                    <View style={styles.courseMeta}>
                      <View style={styles.metaItem}>
                        <Ionicons name="time-outline" size={14} color={colors.mutedForeground} />
                        <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{course.duration}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Ionicons name="document-text-outline" size={14} color={colors.mutedForeground} />
                        <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{course.exam.length} questions</Text>
                      </View>
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            );
          })}

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // COURSE CONTENT VIEW
  if (viewMode === 'course' && selectedCourse) {
    const section = selectedCourse.content[currentSection];
    const isLastSection = currentSection === selectedCourse.content.length - 1;

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        {/* Header */}
        <View style={[styles.courseViewHeader, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleBackToList} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={styles.courseViewHeaderInfo}>
            <Text style={[styles.courseViewTitle, { color: colors.foreground }]} numberOfLines={1}>
              {selectedCourse.title}
            </Text>
            <Text style={[styles.sectionProgress, { color: colors.mutedForeground }]}>
              Section {currentSection + 1} of {selectedCourse.content.length}
            </Text>
          </View>
        </View>

        {/* Section Progress Bar */}
        <View style={styles.sectionProgressBar}>
          {selectedCourse.content.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.sectionDot,
                { backgroundColor: idx <= currentSection ? colors.primary : colors.border },
              ]}
            />
          ))}
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.courseScrollContent}>
          {/* Section Header */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{section.section}</Text>
          {section.subtitle && (
            <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>{section.subtitle}</Text>
          )}

          {/* Section Image */}
          {section.image && (
            <View style={styles.sectionImageContainer}>
              <TouchableOpacity
                onPress={() => {
                  setViewerImage(section.image ?? null);
                  setViewerCaption(section.imageCaption || null);
                  setShowImageViewer(true);
                }}
                activeOpacity={0.8}
              >
                <Image
                  source={typeof section.image === 'number' ? section.image : { uri: section.image }}
                  style={styles.sectionImage}
                  resizeMode="cover"
                />
                <View style={styles.imageExpandHint}>
                  <Ionicons name="expand" size={16} color="#FFFFFF" />
                  <Text style={styles.imageExpandHintText}>Tap to enlarge</Text>
                </View>
              </TouchableOpacity>
              {section.imageCaption && (
                <Text style={[styles.sectionImageCaption, { color: colors.mutedForeground }]}>
                  {section.imageCaption}
                </Text>
              )}
            </View>
          )}

          {/* Section Content */}
          <View style={styles.sectionContent}>
            {section.items.map((item, idx) => {
              if (typeof item === 'string') {
                return (
                  <Text key={idx} style={[styles.contentText, { color: colors.foreground }]}>
                    {item}
                  </Text>
                );
              }

              const contentItem = item as ContentItem;
              return (
                <View
                  key={idx}
                  style={[
                    styles.contentItem,
                    contentItem.type === 'highlight' && [styles.contentHighlight, { backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }],
                    contentItem.type === 'warning' && [styles.contentWarning, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }],
                    contentItem.type === 'tip' && [styles.contentTip, { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' }],
                    contentItem.type === 'formula' && [styles.contentFormula, { backgroundColor: isDark ? colors.secondary : '#F3F4F6', borderColor: colors.border }],
                    contentItem.type === 'example' && [styles.contentExample, { backgroundColor: isDark ? colors.secondary : '#FEF3C7', borderColor: '#FDE68A' }],
                    contentItem.type === 'script' && [styles.contentScript, { backgroundColor: isDark ? colors.secondary : '#E0E7FF', borderColor: '#C7D2FE' }],
                    contentItem.type === 'checklist' && [styles.contentChecklist, { backgroundColor: isDark ? colors.secondary : '#F0FDF4', borderColor: '#BBF7D0' }],
                  ]}
                >
                  {contentItem.type === 'warning' && <Ionicons name="warning" size={16} color="#EF4444" style={styles.contentIcon} />}
                  {contentItem.type === 'tip' && <Ionicons name="bulb" size={16} color="#22C55E" style={styles.contentIcon} />}
                  {contentItem.type === 'checklist' && <Ionicons name="checkmark-circle" size={16} color="#22C55E" style={styles.contentIcon} />}
                  {contentItem.type === 'formula' && <Ionicons name="calculator" size={16} color={colors.primary} style={styles.contentIcon} />}
                  {contentItem.type === 'script' && <Ionicons name="chatbubble-ellipses" size={16} color="#6366F1" style={styles.contentIcon} />}
                  <Text
                    style={[
                      styles.contentItemText,
                      { color: contentItem.type === 'warning' ? '#991B1B' : contentItem.type === 'tip' ? '#166534' : colors.foreground },
                    ]}
                  >
                    {contentItem.content}
                  </Text>
                </View>
              );
            })}

            {section.keyTakeaway && (
              <View style={[styles.keyTakeaway, { backgroundColor: `${colors.primary}15`, borderColor: colors.primary }]}>
                <Ionicons name="key" size={18} color={colors.primary} />
                <Text style={[styles.keyTakeawayText, { color: colors.foreground }]}>
                  <Text style={{ fontWeight: 'bold' }}>Key Takeaway: </Text>
                  {section.keyTakeaway}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <View style={[styles.bottomNav, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonOutline, { borderColor: colors.border }]}
            onPress={() => setCurrentSection(prev => Math.max(0, prev - 1))}
            disabled={currentSection === 0}
          >
            <Ionicons name="chevron-back" size={20} color={currentSection === 0 ? colors.mutedForeground : colors.foreground} />
            <Text style={[styles.navButtonText, { color: currentSection === 0 ? colors.mutedForeground : colors.foreground }]}>
              Previous
            </Text>
          </TouchableOpacity>

          {isLastSection ? (
            <TouchableOpacity style={[styles.navButton, styles.navButtonPrimary, { backgroundColor: colors.primary }]} onPress={handleStartExam}>
              <Text style={styles.navButtonTextPrimary}>Take Exam</Text>
              <Ionicons name="school" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonPrimary, { backgroundColor: colors.primary }]}
              onPress={() => setCurrentSection(prev => prev + 1)}
            >
              <Text style={styles.navButtonTextPrimary}>Next</Text>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Full Screen Image Viewer Modal */}
        <Modal
          visible={showImageViewer}
          transparent
          animationType="fade"
          onRequestClose={() => setShowImageViewer(false)}
          statusBarTranslucent
        >
          <View style={styles.imageViewerOverlay}>
            {/* Close button - at the very top */}
            <TouchableOpacity
              style={styles.imageViewerCloseButton}
              onPress={() => setShowImageViewer(false)}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <View style={styles.closeButtonInner}>
                <Ionicons name="close" size={28} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            {/* Scrollable/Zoomable Image Container */}
            <ScrollView
              style={styles.imageViewerScrollView}
              contentContainerStyle={styles.imageViewerScrollContent}
              maximumZoomScale={5}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent
              bouncesZoom
            >
              {viewerImage && (
                <Image
                  source={typeof viewerImage === 'number' ? viewerImage : { uri: viewerImage }}
                  style={styles.imageViewerImage}
                  resizeMode="contain"
                />
              )}
            </ScrollView>

            {/* Caption at the bottom */}
            {viewerCaption && (
              <View style={styles.imageViewerCaptionContainer}>
                <Text style={styles.imageViewerCaption}>{viewerCaption}</Text>
              </View>
            )}

            {/* Hint text */}
            <Text style={styles.imageViewerHint}>Pinch to zoom • Tap X to close</Text>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // EXAM VIEW
  if (viewMode === 'exam' && selectedCourse) {
    const currentQuestion = selectedCourse.exam[currentQuestionIndex];
    const totalQuestions = selectedCourse.exam.length;
    const answeredCount = Object.keys(examAnswers).length;

    // Show results
    if (showResults && lastExamResult) {
      return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
          <View style={styles.resultsContainer}>
            <View style={[styles.resultsCard, { backgroundColor: isDark ? colors.muted : '#FFFFFF' }]}>
              <View style={[styles.resultsIconContainer, { backgroundColor: lastExamResult.passed ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
                <Ionicons
                  name={lastExamResult.passed ? 'trophy' : 'close-circle'}
                  size={48}
                  color={lastExamResult.passed ? '#22C55E' : '#EF4444'}
                />
              </View>
              <Text style={[styles.resultsTitle, { color: colors.foreground }]}>
                {lastExamResult.passed ? 'Congratulations!' : 'Not Quite'}
              </Text>
              <Text style={[styles.resultsSubtitle, { color: colors.mutedForeground }]}>
                {lastExamResult.passed
                  ? 'You passed the exam!'
                  : 'You need 80% to pass. Review the material and try again.'}
              </Text>
              <View style={[styles.scoreContainer, { backgroundColor: lastExamResult.passed ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
                <Text style={[styles.scoreText, { color: lastExamResult.passed ? '#22C55E' : '#EF4444' }]}>
                  {lastExamResult.score}%
                </Text>
              </View>

              {lastExamResult.passed ? (
                <TouchableOpacity style={[styles.resultButton, { backgroundColor: colors.primary }]} onPress={handleBackToList}>
                  <Text style={styles.resultButtonText}>Continue Training</Text>
                  <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.resultButton, styles.resultButtonOutline, { borderColor: colors.border }]}
                    onPress={() => setViewMode('course')}
                  >
                    <Ionicons name="book" size={20} color={colors.foreground} />
                    <Text style={[styles.resultButtonTextOutline, { color: colors.foreground }]}>Review Material</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.resultButton, { backgroundColor: colors.primary }]} onPress={handleRetryExam}>
                    <Ionicons name="refresh" size={20} color="#FFFFFF" />
                    <Text style={styles.resultButtonText}>Retry Exam</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        {/* Header */}
        <View style={[styles.examHeader, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => setViewMode('course')}>
            <Ionicons name="close" size={24} color={colors.mutedForeground} />
          </TouchableOpacity>
          <Text style={[styles.examHeaderText, { color: colors.foreground }]}>
            Question {currentQuestionIndex + 1} of {totalQuestions}
          </Text>
          <View style={[styles.answeredBadge, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.answeredText, { color: colors.primary }]}>{answeredCount}/{totalQuestions}</Text>
          </View>
        </View>

        {/* Question Progress */}
        <View style={styles.questionProgress}>
          {selectedCourse.exam.map((q, idx) => (
            <View
              key={q.id}
              style={[
                styles.questionDot,
                {
                  backgroundColor: examAnswers[q.id]
                    ? colors.primary
                    : idx === currentQuestionIndex
                      ? `${colors.primary}50`
                      : colors.border,
                },
              ]}
            />
          ))}
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.examScrollContent}>
          <Text style={[styles.questionText, { color: colors.foreground }]}>{currentQuestion.text}</Text>

          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  { borderColor: examAnswers[currentQuestion.id] === option.value ? colors.primary : colors.border },
                  examAnswers[currentQuestion.id] === option.value && { backgroundColor: `${colors.primary}10` },
                ]}
                onPress={() => handleExamAnswer(currentQuestion.id, option.value)}
              >
                <View
                  style={[
                    styles.optionRadio,
                    { borderColor: examAnswers[currentQuestion.id] === option.value ? colors.primary : colors.border },
                    examAnswers[currentQuestion.id] === option.value && { backgroundColor: colors.primary },
                  ]}
                >
                  {examAnswers[currentQuestion.id] === option.value && (
                    <View style={styles.optionRadioInner} />
                  )}
                </View>
                <Text style={[styles.optionText, { color: colors.foreground }]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <View style={[styles.bottomNav, { backgroundColor: isDark ? colors.muted : '#FFFFFF', borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonOutline, { borderColor: colors.border }]}
            onPress={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
          >
            <Ionicons name="chevron-back" size={20} color={currentQuestionIndex === 0 ? colors.mutedForeground : colors.foreground} />
            <Text style={[styles.navButtonText, { color: currentQuestionIndex === 0 ? colors.mutedForeground : colors.foreground }]}>
              Previous
            </Text>
          </TouchableOpacity>

          {currentQuestionIndex === totalQuestions - 1 ? (
            <TouchableOpacity
              style={[
                styles.navButton,
                styles.navButtonPrimary,
                { backgroundColor: answeredCount < totalQuestions ? colors.mutedForeground : colors.primary },
              ]}
              onPress={handleSubmitExam}
              disabled={submitExamMutation.isPending || answeredCount < totalQuestions}
            >
              {submitExamMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.navButtonTextPrimary}>Submit Exam</Text>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.navButton,
                styles.navButtonPrimary,
                { backgroundColor: !examAnswers[currentQuestion.id] ? colors.mutedForeground : colors.primary },
              ]}
              onPress={() => setCurrentQuestionIndex(prev => prev + 1)}
              disabled={!examAnswers[currentQuestion.id]}
            >
              <Text style={styles.navButtonTextPrimary}>Next</Text>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitleSection: {
    flex: 1,
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 4,
  },
  progressCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  progressBarContainer: {
    gap: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
  },
  courseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  courseCardPassed: {
    borderColor: '#22C55E',
  },
  courseCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  courseIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseInfo: {
    flex: 1,
  },
  courseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  passedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  passedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22C55E',
  },
  courseDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  courseMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  // Course View Styles
  courseViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: 12,
  },
  courseViewHeaderInfo: {
    flex: 1,
  },
  courseViewTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionProgress: {
    fontSize: 14,
  },
  sectionProgressBar: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionDot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  courseScrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 16,
    marginBottom: 16,
  },
  sectionContent: {
    gap: 12,
  },
  contentText: {
    fontSize: 16,
    lineHeight: 24,
  },
  contentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  contentIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  contentItemText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  contentHighlight: {},
  contentWarning: {},
  contentTip: {},
  contentFormula: {},
  contentExample: {},
  contentScript: {},
  contentChecklist: {},
  keyTakeaway: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginTop: 16,
    gap: 12,
  },
  keyTakeawayText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  bottomNav: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  navButtonOutline: {
    borderWidth: 1,
  },
  navButtonPrimary: {},
  navButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  navButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Exam Styles
  examHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  examHeaderText: {
    fontSize: 16,
    fontWeight: '600',
  },
  answeredBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  answeredText: {
    fontSize: 14,
    fontWeight: '600',
  },
  questionProgress: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  questionDot: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  examScrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  optionRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  // Results Styles
  resultsContainer: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  resultsCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  resultsIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultsSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  scoreContainer: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  scoreText: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  resultButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    width: '100%',
    marginBottom: 12,
  },
  resultButtonOutline: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  resultButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resultButtonTextOutline: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionImageContainer: {
    marginVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  sectionImage: {
    width: SCREEN_WIDTH - 32,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  imageExpandHint: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  imageExpandHintText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '500',
  },
  sectionImageCaption: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Image Viewer Styles
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 100,
  },
  closeButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageViewerScrollView: {
    flex: 1,
    marginTop: 100,
    marginBottom: 80,
  },
  imageViewerScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.6,
  },
  imageViewerCaptionContainer: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
  },
  imageViewerCaption: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 14,
    fontStyle: 'italic',
  },
  imageViewerHint: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
  },
});



