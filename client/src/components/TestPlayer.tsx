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
import { saveTestResult, saveTestSession, deleteTestSession } from "@/lib/storage";

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
      let newAnswers;
      
      if (isMultiple) {
        // Для множественного выбора
        if (currentAnswers.includes(optionId)) {
          newAnswers = {
            ...prev,
            [questionId]: currentAnswers.filter(id => id !== optionId)
          };
        } else {
          newAnswers = {
            ...prev,
            [questionId]: [...currentAnswers, optionId]
          };
        }
      } else {
        // Для одиночного выбора
        newAnswers = {
          ...prev,
          [questionId]: [optionId]
        };
        
        // Если это одиночный выбор, автоматически переходим к следующему вопросу
        setTimeout(() => {
          if (currentQuestionIndex < questions.length - 1) {
            handleNextQuestion();
          } else {
            calculateScore();
          }
        }, 500); // Добавляем небольшую задержку для анимации выбора
      }
      
      return newAnswers;
    });
    
    // Если текущий тест существует, сохраняем состояние сессии
    if (currentTest) {
      setTimeout(() => {
        const updatedAnswers = {...answers};
        if (!isMultiple) {
          updatedAnswers[questionId] = [optionId];
        } else if (updatedAnswers[questionId]?.includes(optionId)) {
          updatedAnswers[questionId] = updatedAnswers[questionId].filter(id => id !== optionId);
        } else {
          updatedAnswers[questionId] = [...(updatedAnswers[questionId] || []), optionId];
        }
        
        const session: TestSession = {
          testId: currentTest.id,
          currentQuestionIndex,
          answers: updatedAnswers,
          totalQuestions: currentTest.questions.length,
          startTime: startTime ? startTime : undefined,
          pausedTime,
          lastPauseTime: lastPauseTime ? lastPauseTime : undefined,
          isPaused,
          correctAnswers,
          wrongAnswers
        };
        
        saveTestSession(currentTest.id, session);
      }, 100);
    }
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
        startTime: startTime ? startTime : undefined,
        pausedTime,
        lastPauseTime: new Date(),
        isPaused: true,
        correctAnswers,
        wrongAnswers
      };
      
      setTestSession(session);
      
      // Принудительное сохранение сессии в локальное хранилище
      saveTestSession(currentTest!.id, session);
    } else if (showResults) {
      // Сброс сессии при показе результатов
      setTestSession(null);
      
      // Удаляем сохраненную сессию из локального хранилища
      if (currentTest) {
        deleteTestSession(currentTest.id);
      }
    } else if (isPaused) {
      // Если уже на паузе, создаем и сохраняем текущую сессию
      if (currentTest) {
        const currentSession: TestSession = {
          testId: currentTest.id,
          currentQuestionIndex,
          answers,
          totalQuestions: currentTest.questions.length,
          startTime: startTime ? startTime : undefined,
          pausedTime,
          lastPauseTime: lastPauseTime ? lastPauseTime : undefined,
          isPaused: true,
          correctAnswers,
          wrongAnswers
        };
        saveTestSession(currentTest.id, currentSession);
      }
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
    let resultBgClass = "";
    
    if (percentage >= 80) {
      resultMessage = "Отличный результат!";
      resultColor = "text-green-600 dark:text-green-400";
      resultBgClass = "bg-green-50 dark:bg-green-900/30";
    } else if (percentage >= 60) {
      resultMessage = "Хороший результат!";
      resultColor = "text-blue-600 dark:text-blue-400";
      resultBgClass = "bg-blue-50 dark:bg-blue-900/30";
    } else if (percentage >= 40) {
      resultMessage = "Неплохой результат, но можно лучше!";
      resultColor = "text-yellow-600 dark:text-yellow-400";
      resultBgClass = "bg-yellow-50 dark:bg-yellow-900/30";
    } else {
      resultMessage = "Стоит повторить материал.";
      resultColor = "text-red-600 dark:text-red-400";
      resultBgClass = "bg-red-50 dark:bg-red-900/30";
    }
    
    const totalTime = startTime ? new Date().getTime() - startTime.getTime() - pausedTime : 0;
    
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center text-primary mb-2">Результаты теста</DialogTitle>
            <p className="text-center text-lg text-gray-600 dark:text-gray-400">{test.title}</p>
          </DialogHeader>
          
          <div className="py-8 text-center">
            <div className={`p-8 rounded-xl ${resultBgClass} mb-8`}>
              <h3 className="text-2xl font-bold mb-6">Ваш результат</h3>
              
              <div className="mb-6">
                <div className="flex justify-center items-center text-6xl font-bold mb-4">
                  <span className={resultColor}>{score.correct}</span>
                  <span className="text-gray-400 mx-3">/</span>
                  <span>{score.total}</span>
                </div>
                <div className="text-xl mb-4">
                  <span className={`${resultColor} font-semibold`}>{percentage.toFixed(0)}%</span>
                </div>
                <p className="text-lg font-medium mb-6">{resultMessage}</p>
                
                <Progress value={percentage} className="h-4 w-full max-w-md mx-auto" />
              </div>
            </div>
            
            <div className="flex justify-center items-center gap-8 mb-8">
              <div className="flex items-center bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-xl">
                <Clock className="w-6 h-6 mr-3 text-primary" />
                <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                  Время: {formatTime(totalTime)}
                </span>
              </div>
              
              <div className="flex items-center bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-xl">
                <Check className="w-6 h-6 mr-3 text-green-500" />
                <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                  Верно: {score.correct} из {score.total}
                </span>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
              <Button variant="outline" onClick={handleRetry} className="px-6 py-3 h-14 text-lg font-medium" size="lg">
                Пройти еще раз
              </Button>
              <Button onClick={handleClose} className="px-6 py-3 h-14 text-lg font-medium bg-primary hover:bg-primary/90" size="lg">
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
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-primary">{test.title}</DialogTitle>
        </DialogHeader>
        
        {/* Прогресс теста и таймер */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <span className="text-base font-medium text-gray-700 dark:text-gray-300 mr-2">
                Вопрос {currentQuestionIndex + 1} из {questions.length}
              </span>
              {isPaused && (
                <Badge variant="outline" className="ml-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                  <Pause className="w-3 h-3 mr-1" /> На паузе
                </Badge>
              )}
            </div>
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
              <Clock className="w-5 h-5 mr-2 text-primary" />
              <span className="text-base font-semibold text-gray-700 dark:text-gray-300">
                {formatTime(elapsedTime)}
              </span>
            </div>
          </div>
          <Progress value={progress} className="h-3 bg-gray-200 dark:bg-gray-700" />
        </div>
        
        {/* Содержимое вопроса */}
        <div className="mb-8 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            {currentQuestionIndex + 1}. {currentQuestion.text}
          </h4>
          
          {isMultipleChoice(currentQuestion) ? (
            // Множественный выбор (чекбоксы)
            <div className="space-y-4">
              {currentQuestion.options.map((option) => (
                <div 
                  key={option.id} 
                  className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${isOptionSelected(currentQuestion.id, option.id) ? 'bg-primary-50 dark:bg-primary-900 border-primary-300 dark:border-primary-700' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  onClick={() => handleAnswerSelect(currentQuestion.id, option.id, true)}
                >
                  <Checkbox
                    id={`q${currentQuestion.id}_option${option.id}`}
                    checked={isOptionSelected(currentQuestion.id, option.id)}
                    onCheckedChange={(checked) => {
                      if (checked !== "indeterminate") {
                        handleAnswerSelect(currentQuestion.id, option.id, true);
                      }
                    }}
                    className="mr-3 h-5 w-5"
                  />
                  <Label
                    htmlFor={`q${currentQuestion.id}_option${option.id}`}
                    className="text-base text-gray-900 dark:text-gray-300 cursor-pointer w-full"
                  >
                    {option.text}
                  </Label>
                </div>
              ))}
              
              <div className="flex items-center mt-6 text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-md">
                <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" />
                <span className="text-sm">Выберите все подходящие варианты и нажмите «Далее»</span>
              </div>
            </div>
          ) : (
            // Одиночный выбор (большие кнопки)
            <RadioGroup
              value={answers[currentQuestion.id]?.[0]?.toString() || ""}
              onValueChange={(value) => 
                handleAnswerSelect(currentQuestion.id, parseInt(value), false)
              }
              className="space-y-4"
            >
              {currentQuestion.options.map((option) => (
                <div 
                  key={option.id} 
                  className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${isOptionSelected(currentQuestion.id, option.id) ? 'bg-primary-50 dark:bg-primary-900 border-primary-300 dark:border-primary-700' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  onClick={() => handleAnswerSelect(currentQuestion.id, option.id, false)}
                >
                  <RadioGroupItem
                    id={`q${currentQuestion.id}_option${option.id}`}
                    value={option.id.toString()}
                    className="mr-3 h-5 w-5"
                  />
                  <Label
                    htmlFor={`q${currentQuestion.id}_option${option.id}`}
                    className="text-base text-gray-900 dark:text-gray-300 cursor-pointer w-full"
                  >
                    {option.text}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
        </div>
        
        <DialogFooter className="flex flex-col md:flex-row justify-between gap-4 mt-4">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handlePrevQuestion}
              disabled={currentQuestionIndex === 0 || isPaused}
              className="px-6 py-2 h-12 text-base font-medium"
              size="lg"
            >
              <ChevronLeft className="w-5 h-5 mr-2" />
              Назад
            </Button>
            
            <Button
              variant={isPaused ? "default" : "outline"}
              onClick={handleTogglePause}
              className={`px-6 py-2 h-12 text-base font-medium ${isPaused ? 'bg-green-600 hover:bg-green-700' : ''}`}
              size="lg"
            >
              {isPaused ? (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Продолжить
                </>
              ) : (
                <>
                  <Pause className="w-5 h-5 mr-2" />
                  Пауза
                </>
              )}
            </Button>
          </div>
          
          <div className="flex gap-3 md:ml-auto">
            <Button 
              variant="destructive" 
              onClick={handleFinishTest}
              disabled={isPaused}
              className="px-6 py-2 h-12 text-base font-medium"
              size="lg"
            >
              Завершить досрочно
              <ExternalLink className="w-5 h-5 ml-2" />
            </Button>
            
            {isMultipleChoice(currentQuestion) && currentQuestionIndex < questions.length - 1 ? (
              <Button 
                onClick={handleNextQuestion} 
                disabled={isPaused}
                className="px-6 py-2 h-12 text-base font-medium bg-primary hover:bg-primary/90"
                size="lg"
              >
                Далее
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            ) : isMultipleChoice(currentQuestion) ? (
              <Button 
                onClick={handleNextQuestion} 
                disabled={isPaused}
                className="px-6 py-2 h-12 text-base font-medium bg-primary hover:bg-primary/90"
                size="lg"
              >
                Завершить
                <Check className="w-5 h-5 ml-2" />
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TestPlayer;
