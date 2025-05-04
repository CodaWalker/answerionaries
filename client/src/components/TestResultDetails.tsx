import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { LocalTestResult } from "@/lib/storage";
import { TestWithQuestions } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Check, X, ChevronRight, ChevronDown } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type TestResultDetailsProps = {
  isOpen: boolean;
  onClose: () => void;
  result: LocalTestResult;
};

const TestResultDetails = ({ isOpen, onClose, result }: TestResultDetailsProps) => {
  const [expandedQuestions, setExpandedQuestions] = useState<Record<number, boolean>>({});
  
  // Получаем полные данные теста, чтобы отобразить правильные ответы
  const { data: testData } = useQuery<TestWithQuestions>({
    queryKey: [`/api/tests/${result.testId}/full`],
    enabled: isOpen,
  });
  
  // Рассчитываем статистику
  const correctAnswers = result.score;
  const incorrectAnswers = result.totalQuestions - result.score;
  const percentage = Math.round((result.score / result.totalQuestions) * 100);
  const grade = percentage >= 80 ? "Отлично" : percentage >= 60 ? "Хорошо" : percentage >= 40 ? "Удовлетворительно" : "Неудовлетворительно";
  
  // Находим список вопросов с неправильными ответами
  const incorrectQuestions = testData?.questions.filter((question) => {
    const userAnswers = result.answers[question.id] || [];
    const correctOptionIds = question.options
      .filter(option => option.isCorrect)
      .map(option => option.id);
    
    // Проверяем соответствие ответов пользователя правильным ответам
    if (userAnswers.length !== correctOptionIds.length) return true;
    return !userAnswers.every(answerId => correctOptionIds.includes(answerId));
  });
  
  const toggleQuestion = (questionId: number) => {
    setExpandedQuestions(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };
  
  // Форматируем дату и время
  const formatDateTime = (date: Date) => {
    const d = new Date(date);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
  };
  
  // Форматируем время прохождения теста
  const formatTime = (seconds?: number) => {
    if (!seconds) return "Нет данных";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} мин ${remainingSeconds} сек`;
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Результаты тестирования: {testData?.title}</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-4 my-4">
          <div className="p-4 bg-muted/30 rounded-lg">
            <h3 className="text-sm font-medium mb-2">Основная информация</h3>
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Дата:</span>
                <span>{formatDateTime(result.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Время прохождения:</span>
                <span>{formatTime(result.timeTaken)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Статус:</span>
                <span>{result.isCompleted ? "Завершен" : "Не завершен"}</span>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-muted/30 rounded-lg">
            <h3 className="text-sm font-medium mb-2">Результаты</h3>
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Баллы:</span>
                <span>{result.score} из {result.totalQuestions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Процент:</span>
                <span>{percentage}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Оценка:</span>
                <Badge variant={percentage >= 60 ? "default" : "destructive"}>{grade}</Badge>
              </div>
            </div>
          </div>
        </div>
        
        <Separator className="my-2" />
        
        <div className="mb-2">
          <h3 className="text-sm font-medium">Статистика ответов</h3>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="flex items-center space-x-2 p-2 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900">
              <Check className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">Правильных ответов: {correctAnswers}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 p-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900">
              <X className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300">Неправильных ответов: {incorrectAnswers}</p>
              </div>
            </div>
          </div>
        </div>
        
        {testData && incorrectQuestions && incorrectQuestions.length > 0 && (
          <>
            <h3 className="text-sm font-medium mb-2">Ошибки в вопросах</h3>
            <ScrollArea className="flex-1 border rounded-md p-2">
              <div className="space-y-3">
                {incorrectQuestions.map(question => {
                  // Ответы пользователя на данный вопрос
                  const userAnswerIds = result.answers[question.id] || [];
                  // Текстовые представления ответов пользователя
                  const userAnswers = question.options
                    .filter(option => userAnswerIds.includes(option.id))
                    .map(option => option.text);
                  // Правильные ответы
                  const correctAnswers = question.options
                    .filter(option => option.isCorrect)
                    .map(option => option.text);
                  
                  return (
                    <Collapsible 
                      key={question.id}
                      open={expandedQuestions[question.id]}
                      onOpenChange={() => toggleQuestion(question.id)}
                      className="border rounded-md overflow-hidden"
                    >
                      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 text-left hover:bg-muted/50">
                        <div className="flex items-center">
                          <X className="h-4 w-4 text-red-500 mr-2" />
                          <span className="text-sm font-medium">Вопрос {question.id}</span>
                        </div>
                        {expandedQuestions[question.id] ? 
                          <ChevronDown className="h-4 w-4" /> : 
                          <ChevronRight className="h-4 w-4" />}
                      </CollapsibleTrigger>
                      <CollapsibleContent className="p-3 bg-muted/20">
                        <p className="mb-2">{question.text}</p>
                        
                        <div className="space-y-3">
                          <div className="bg-red-50 dark:bg-red-900/10 p-2 rounded-md border border-red-100 dark:border-red-800">
                            <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">Ваш ответ:</p>
                            <ul className="list-disc list-inside text-sm">
                              {userAnswers.length > 0 ? 
                                userAnswers.map((answer, idx) => <li key={idx} className="text-red-700 dark:text-red-300">{answer}</li>) : 
                                <li className="text-red-700 dark:text-red-300">Не выбран</li>}
                            </ul>
                          </div>
                          
                          <div className="bg-green-50 dark:bg-green-900/10 p-2 rounded-md border border-green-100 dark:border-green-800">
                            <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">Правильный ответ:</p>
                            <ul className="list-disc list-inside text-sm">
                              {correctAnswers.map((answer, idx) => 
                                <li key={idx} className="text-green-700 dark:text-green-300">{answer}</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}
        
        <DialogFooter className="mt-4">
          <Button onClick={onClose}>Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TestResultDetails;