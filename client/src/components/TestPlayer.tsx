import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { X, ChevronLeft, ChevronRight, Check, AlertTriangle, Clock, Pause, Play, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertResultSchema, TestWithQuestions, TestSession } from "@shared/schema";
import { useAppContext } from "@/context/AppContext";
import { saveTestResult } from "@/lib/storage";

type TestPlayerProps = {
  isOpen: boolean;
  onClose: () => void;
  testId: number | null;
  resumeSession?: TestSession | null;
};

const TestPlayer = ({ isOpen, onClose, testId, resumeSession }: TestPlayerProps) => {
  const { toast } = useToast();
  const { currentTest, setTestSession } = useAppContext();
  
  // Состояния
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number[]>>({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0); // в миллисекундах
  const [pausedTime, setPausedTime] = useState(0); // общее время на паузе
  const [lastPauseTime, setLastPauseTime] = useState<Date | null>(null);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState(0);
  
  // Таймер для обновления времени
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Инициализация сессии
  useEffect(() => {
    if (isOpen && currentTest) {
      if (resumeSession) {
        // Восстановление сохраненной сессии
        setCurrentQuestionIndex(resumeSession.currentQuestionIndex);
        setAnswers(resumeSession.answers || {});
        setStartTime(resumeSession.startTime || new Date());
        setPausedTime(resumeSession.pausedTime || 0);
        setIsPaused(resumeSession.isPaused || false);
        setCorrectAnswers(resumeSession.correctAnswers || 0);
        setWrongAnswers(resumeSession.wrongAnswers || 0);
      } else {
        // Новая сессия
        setCurrentQuestionIndex(0);
        setAnswers({});
        setShowResults(false);
        setStartTime(new Date());
        setPausedTime(0);
        setElapsedTime(0);
        setIsPaused(false);
        setCorrectAnswers(0);
        setWrongAnswers(0);
      }
    }
  }, [isOpen, currentTest, resumeSession]);
  
  // Обновление времени
  useEffect(() => {
    if (isOpen && startTime && !isPaused && !showResults) {
      intervalRef.current = setInterval(() => {
        const now = new Date();
        const elapsed = now.getTime() - startTime.getTime() - pausedTime;
        setElapsedTime(elapsed);
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isOpen, startTime, isPaused, pausedTime, showResults]);
  
  // Сохранение сессии при изменении
  useEffect(() => {
    if (isOpen && currentTest && !showResults) {
      const session: TestSession = {
        testId: currentTest.id,
        currentQuestionIndex,
        answers,
        totalQuestions: currentTest.questions.length,
        startTime: startTime || undefined,
        pausedTime,
        lastPauseTime: lastPauseTime || undefined,
        isPaused,
        correctAnswers,
        wrongAnswers
      };
      
      setTestSession(session);
    }
  }, [currentQuestionIndex, answers, isPaused, pausedTime, startTime, lastPauseTime, currentTest, isOpen, showResults, correctAnswers, wrongAnswers, setTestSession]);
  
  // Мутация для сохранения результата
  const saveResultMutation = useMutation({
    mutationFn: async (result: { 
      testId: number; 
      score: number; 
      totalQuestions: number; 
      answers: Record<number, number[]>;
      timeTaken?: number;
      isCompleted?: boolean;
      isPaused?: boolean;
    }) => {
      const response = await apiRequest('POST', '/api/results', result);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/results'] });
      toast({
        title: "Результат сохранен",
        description: "Результат теста был успешно сохранен",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить результат. Результат будет сохранен локально.",
        variant: "destructive",
      });
      
      // Сохраняем локально в случае ошибки
      if (currentTest) {
        const testSession: TestSession = {
          testId: currentTest.id,
          currentQuestionIndex,
          answers,
          totalQuestions: currentTest.questions.length
        };
        
        saveTestResult({
          testId: currentTest.id,
          testTitle: currentTest.title,
          score: score.correct,
          totalQuestions: score.total,
          answers,
          date: new Date()
        });
      }
    }
  });
  
  // Если тест не выбран или не загружен
  if (!currentTest) {
    return null;
  }
  
  const test = currentTest;
  const questions = test.questions;
  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  
  // Форматирование времени
  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return [
      hours > 0 ? hours.toString().padStart(2, '0') : null,
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0')
    ].filter(Boolean).join(':');
  };
  
  // Обработчик паузы
  const handleTogglePause = () => {
    if (isPaused) {
      // Восстановление после паузы
      if (lastPauseTime) {
        const now = new Date();
        const pauseDuration = now.getTime() - lastPauseTime.getTime();
        setPausedTime(prev => prev + pauseDuration);
      }
      setIsPaused(false);
    } else {
      // Постановка на паузу
      setLastPauseTime(new Date());
      setIsPaused(true);
    }
  };
  
  // Обработчики навигации
  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };
  
  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      // Проверка ответа на текущий вопрос для статистики
      const currentQuestion = questions[currentQuestionIndex];
      const correctOptionIds = currentQuestion.options
        .filter(option => option.isCorrect)
        .map(option => option.id);
      
      const userAnswers = answers[currentQuestion.id] || [];
      
      const isCorrect = 
        correctOptionIds.length === userAnswers.length && 
        correctOptionIds.every(id => userAnswers.includes(id));
      
      if (isCorrect) {
        setCorrectAnswers(prev => prev + 1);
      } else if (userAnswers.length > 0) { // если пользователь ответил на вопрос
        setWrongAnswers(prev => prev + 1);
      }
      
      // Переход к следующему вопросу
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      calculateScore();
    }
  };
  
  // Обработчик завершения теста
  const handleFinishTest = () => {
    calculateScore();
  };
  
  // Обработчик ответа на вопрос
  const handleAnswerSelect = (questionId: number, optionId: number, isMultiple: boolean) => {
    setAnswers(prev => {
      const currentAnswers = prev[questionId] || [];
      
      if (isMultiple) {
        // Для множественного выбора
        if (currentAnswers.includes(optionId)) {
          return {
            ...prev,
            [questionId]: currentAnswers.filter(id => id !== optionId)
          };
        } else {
          return {
            ...prev,
            [questionId]: [...currentAnswers, optionId]
          };
        }
      } else {
        // Для одиночного выбора
        return {
          ...prev,
          [questionId]: [optionId]
        };
      }
    });
  };
  
  // Проверяем, выбран ли вариант ответа
  const isOptionSelected = (questionId: number, optionId: number) => {
    const questionAnswers = answers[questionId] || [];
    return questionAnswers.includes(optionId);
  };
  
  // Подсчет результатов
  const calculateScore = () => {
    // Очистка интервала
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    let correct = 0;
    
    questions.forEach(question => {
      const correctOptionIds = question.options
        .filter(option => option.isCorrect)
        .map(option => option.id);
      
      const userAnswers = answers[question.id] || [];
      
      // Проверяем, совпадают ли ответы пользователя с правильными ответами
      const isCorrect = 
        correctOptionIds.length === userAnswers.length && 
        correctOptionIds.every(id => userAnswers.includes(id));
      
      if (isCorrect) {
        correct++;
      }
    });
    
    const total = questions.length;
    setScore({ correct, total });
    setShowResults(true);
    
    // Вычисление общего времени
    const now = new Date();
    const totalTime = startTime ? now.getTime() - startTime.getTime() - pausedTime : 0;
    const timeInSeconds = Math.floor(totalTime / 1000);
    
    // Сохраняем результат
    saveResultMutation.mutate({
      testId: test.id,
      score: correct,
      totalQuestions: total,
      answers,
      timeTaken: timeInSeconds,
      isCompleted: true,
      isPaused: false
    });
    
    // Дублируем сохранение локально для надежности
    saveTestResult({
      testId: test.id,
      testTitle: test.title,
      score: correct,
      totalQuestions: total,
      answers,
      date: new Date()
    });
    
    // Сброс сессии
    setTestSession(null);
  };
  
  // Определяем, нужен ли множественный выбор для текущего вопроса
  const isMultipleChoice = (question: typeof currentQuestion) => {
    return question.options.filter(o => o.isCorrect).length > 1;
  };
  
  // Обработчики сессии
  const handleClose = () => {
    if (!showResults && !isPaused) {
      // Предложить сохранить сессию на паузе
      toast({
        title: "Сессия завершена",
        description: "Ваш прогресс был сохранен. Вы можете продолжить позже.",
      });
      
      // Установка сессии на паузу перед закрытием
      setIsPaused(true);
      setLastPauseTime(new Date());
      
      const session: TestSession = {
        testId: currentTest!.id,
        currentQuestionIndex,
        answers,
        totalQuestions: currentTest!.questions.length,
        startTime: startTime || undefined,
        pausedTime,
        lastPauseTime: new Date(),
        isPaused: true,
        correctAnswers,
        wrongAnswers
      };
      
      setTestSession(session);
    } else {
      // Сброс сессии при показе результатов или уже на паузе
      setTestSession(null);
    }
    
    // Очистка интервала
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    onClose();
  };
  
  const handleRetry = () => {
    setCurrentQuestionIndex(0);
    setAnswers({});
    setShowResults(false);
    setStartTime(new Date());
    setPausedTime(0);
    setElapsedTime(0);
    setIsPaused(false);
    setCorrectAnswers(0);
    setWrongAnswers(0);
  };
  
  // Отображение результатов
  if (showResults) {
    const percentage = (score.correct / score.total) * 100;
    let resultMessage = "";
    let resultColor = "";
    
    if (percentage >= 80) {
      resultMessage = "Отличный результат!";
      resultColor = "text-green-600 dark:text-green-400";
    } else if (percentage >= 60) {
      resultMessage = "Хороший результат!";
      resultColor = "text-blue-600 dark:text-blue-400";
    } else if (percentage >= 40) {
      resultMessage = "Неплохой результат, но можно лучше!";
      resultColor = "text-yellow-600 dark:text-yellow-400";
    } else {
      resultMessage = "Стоит повторить материал.";
      resultColor = "text-red-600 dark:text-red-400";
    }
    
    const totalTime = startTime ? new Date().getTime() - startTime.getTime() - pausedTime : 0;
    
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Результаты теста: {test.title}</DialogTitle>
          </DialogHeader>
          
          <div className="py-6 text-center">
            <h3 className="text-xl font-semibold mb-4">Ваш результат</h3>
            
            <div className="mb-6">
              <div className="flex justify-center items-center text-5xl font-bold mb-2">
                <span className={resultColor}>{score.correct}</span>
                <span className="text-gray-400 mx-2">/</span>
                <span>{score.total}</span>
              </div>
              <div className="text-lg mb-4">
                <span className={resultColor}>{percentage.toFixed(0)}%</span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-6">{resultMessage}</p>
              
              <Progress value={percentage} className="h-3 w-full max-w-md mx-auto" />
            </div>
            
            <div className="flex justify-center mt-4 mb-6">
              <div className="flex items-center">
                <Clock className="w-5 h-5 mr-2 text-gray-500" />
                <span className="text-gray-700 dark:text-gray-300">
                  Время: {formatTime(totalTime)}
                </span>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
              <Button variant="outline" onClick={handleRetry}>
                Пройти еще раз
              </Button>
              <Button onClick={handleClose}>
                Завершить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  // Отображение вопроса
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Тест: {test.title}</DialogTitle>
        </DialogHeader>
        
        {/* Прогресс теста и таймер */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
                Прогресс: {currentQuestionIndex + 1} из {questions.length}
              </span>
              {isPaused && (
                <Badge variant="secondary" className="ml-2">
                  <Pause className="w-3 h-3 mr-1" /> На паузе
                </Badge>
              )}
            </div>
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-1 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-3">
                {formatTime(elapsedTime)}
              </span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {progress.toFixed(0)}%
              </span>
            </div>
          </div>
          <Progress value={progress} className="h-2.5" />
        </div>
        
        {/* Содержимое вопроса */}
        <div className="mb-6">
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            {currentQuestionIndex + 1}. {currentQuestion.text}
          </h4>
          
          {isMultipleChoice(currentQuestion) ? (
            // Множественный выбор (чекбоксы)
            <div className="space-y-3">
              {currentQuestion.options.map((option) => (
                <div key={option.id} className="flex items-center">
                  <Checkbox
                    id={`q${currentQuestion.id}_option${option.id}`}
                    checked={isOptionSelected(currentQuestion.id, option.id)}
                    onCheckedChange={(checked) => {
                      if (checked !== "indeterminate") {
                        handleAnswerSelect(currentQuestion.id, option.id, true);
                      }
                    }}
                    className="mr-2"
                  />
                  <Label
                    htmlFor={`q${currentQuestion.id}_option${option.id}`}
                    className="text-sm font-medium text-gray-900 dark:text-gray-300 cursor-pointer"
                  >
                    {option.text}
                  </Label>
                </div>
              ))}
              
              <div className="flex items-center mt-4 text-yellow-600 dark:text-yellow-400">
                <AlertTriangle className="w-4 h-4 mr-2" />
                <span className="text-xs">Выберите все подходящие варианты</span>
              </div>
            </div>
          ) : (
            // Одиночный выбор (радиокнопки)
            <RadioGroup
              value={answers[currentQuestion.id]?.[0]?.toString() || ""}
              onValueChange={(value) => 
                handleAnswerSelect(currentQuestion.id, parseInt(value), false)
              }
              className="space-y-3"
            >
              {currentQuestion.options.map((option) => (
                <div key={option.id} className="flex items-center">
                  <RadioGroupItem
                    id={`q${currentQuestion.id}_option${option.id}`}
                    value={option.id.toString()}
                    className="mr-2"
                  />
                  <Label
                    htmlFor={`q${currentQuestion.id}_option${option.id}`}
                    className="text-sm font-medium text-gray-900 dark:text-gray-300 cursor-pointer"
                  >
                    {option.text}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
        </div>
        
        <DialogFooter className="flex flex-col sm:flex-row justify-between gap-3">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handlePrevQuestion}
              disabled={currentQuestionIndex === 0 || isPaused}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Назад
            </Button>
            
            <Button
              variant={isPaused ? "default" : "outline"}
              onClick={handleTogglePause}
            >
              {isPaused ? (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Продолжить
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Пауза
                </>
              )}
            </Button>
          </div>
          
          <div className="flex gap-2 sm:ml-auto">
            <Button 
              variant="destructive" 
              onClick={handleFinishTest}
              disabled={isPaused}
            >
              Завершить досрочно
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
            
            {currentQuestionIndex < questions.length - 1 ? (
              <Button onClick={handleNextQuestion} disabled={isPaused}>
                Далее
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleNextQuestion} disabled={isPaused}>
                Завершить
                <Check className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TestPlayer;
