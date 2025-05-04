import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { X, Plus, Save, Trash, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { TestWithQuestions } from "@shared/schema";

type CreateTestModalProps = {
  isOpen: boolean;
  onClose: () => void;
  testToEdit?: TestWithQuestions | null;
};

type QuestionData = {
  id?: number;
  text: string;
  options: {
    id?: number;
    text: string;
    isCorrect: boolean;
  }[];
};

const CreateTestModal = ({ isOpen, onClose, testToEdit }: CreateTestModalProps) => {
  const { toast } = useToast();
  
  // Состояния
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const QUESTIONS_PER_PAGE = 5; // Максимум 5 вопросов на странице
  
  // Эффект для заполнения данных при редактировании
  useEffect(() => {
    if (testToEdit) {
      setTitle(testToEdit.title);
      setDescription(testToEdit.description || "");
      setIsEditing(true);
      // При редактировании теста, всегда открываем первую страницу
      setCurrentPage(1);
      
      // Преобразуем вопросы и варианты ответов в нужный формат
      const formattedQuestions = testToEdit.questions.map(q => ({
        id: q.id,
        text: q.text,
        options: q.options.map(o => ({
          id: o.id,
          text: o.text,
          isCorrect: o.isCorrect
        }))
      }));
      
      setQuestions(formattedQuestions);
    } else {
      resetForm();
    }
  }, [testToEdit]);
  
  // Мутация для создания теста
  const createTestMutation = useMutation({
    mutationFn: async (data: {
      test: { title: string; description: string };
      questions: Array<{
        question: { text: string };
        options: Array<{ text: string; isCorrect: boolean }>;
      }>;
    }) => {
      const response = await apiRequest('POST', '/api/tests/full', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tests'] });
      toast({
        title: "Тест создан",
        description: "Тест успешно создан",
      });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось создать тест",
        variant: "destructive",
      });
    }
  });
  
  // Мутация для обновления теста
  const updateTestMutation = useMutation({
    mutationFn: async (data: {
      testId: number;
      test: { title: string; description: string };
      questions: Array<{
        id?: number;
        text: string;
        options: Array<{
          id?: number;
          text: string;
          isCorrect: boolean;
        }>;
      }>;
    }) => {
      // Обновляем информацию о тесте
      await apiRequest('PUT', `/api/tests/${data.testId}`, data.test);
      
      // TODO: В реальном приложении нужно реализовать эндпоинт для обновления всего теста
      // Сейчас просто перезапишем старые данные
      
      const response = await apiRequest('DELETE', `/api/tests/${data.testId}`);
      
      const newTestData = {
        test: data.test,
        questions: data.questions.map(q => ({
          question: { text: q.text },
          options: q.options.map(o => ({
            text: o.text,
            isCorrect: o.isCorrect
          }))
        }))
      };
      
      const createResponse = await apiRequest('POST', '/api/tests/full', newTestData);
      return createResponse.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tests'] });
      toast({
        title: "Тест обновлен",
        description: "Тест успешно обновлен",
      });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить тест",
        variant: "destructive",
      });
    }
  });
  
  // Обработчики событий
  const handleAddQuestion = () => {
    const newQuestions = [
      ...questions,
      {
        text: "",
        options: [
          { text: "", isCorrect: false },
          { text: "", isCorrect: false }
        ]
      }
    ];
    setQuestions(newQuestions);
    
    // Переход к последней странице, если добавление нового вопроса создает новую страницу
    const totalPages = Math.ceil(newQuestions.length / QUESTIONS_PER_PAGE);
    if (totalPages > Math.ceil(questions.length / QUESTIONS_PER_PAGE)) {
      setCurrentPage(totalPages);
    }
  };
  
  const handleRemoveQuestion = (index: number) => {
    const updatedQuestions = [...questions];
    updatedQuestions.splice(index, 1);
    setQuestions(updatedQuestions);
    
    // Пересчитываем общее количество страниц после удаления вопроса
    const totalPages = Math.ceil(updatedQuestions.length / QUESTIONS_PER_PAGE);
    
    // Если текущая страница больше чем новое количество страниц, переходим на последнюю страницу
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  };
  
  const handleQuestionTextChange = (index: number, text: string) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index].text = text;
    setQuestions(updatedQuestions);
  };
  
  const handleAddOption = (questionIndex: number) => {
    const updatedQuestions = [...questions];
    updatedQuestions[questionIndex].options.push({
      text: "",
      isCorrect: false
    });
    setQuestions(updatedQuestions);
  };
  
  const handleRemoveOption = (questionIndex: number, optionIndex: number) => {
    const updatedQuestions = [...questions];
    updatedQuestions[questionIndex].options.splice(optionIndex, 1);
    setQuestions(updatedQuestions);
  };
  
  const handleOptionTextChange = (questionIndex: number, optionIndex: number, text: string) => {
    const updatedQuestions = [...questions];
    updatedQuestions[questionIndex].options[optionIndex].text = text;
    setQuestions(updatedQuestions);
  };
  
  const handleOptionCorrectChange = (questionIndex: number, optionIndex: number, isCorrect: boolean) => {
    const updatedQuestions = [...questions];
    updatedQuestions[questionIndex].options[optionIndex].isCorrect = isCorrect;
    setQuestions(updatedQuestions);
  };
  
  // Валидация данных
  const validateForm = (): string | null => {
    if (!title.trim()) {
      return "Введите название теста";
    }
    
    if (questions.length === 0) {
      return "Добавьте хотя бы один вопрос";
    }
    
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      
      if (!question.text.trim()) {
        return `Вопрос ${i + 1}: введите текст вопроса`;
      }
      
      if (question.options.length < 2) {
        return `Вопрос ${i + 1}: добавьте минимум 2 варианта ответа`;
      }
      
      const hasCorrectOption = question.options.some(o => o.isCorrect);
      if (!hasCorrectOption) {
        return `Вопрос ${i + 1}: выберите хотя бы один правильный ответ`;
      }
      
      const allCorrect = question.options.every(o => o.isCorrect);
      if (allCorrect) {
        return `Вопрос ${i + 1}: не все варианты ответов могут быть правильными`;
      }
      
      for (let j = 0; j < question.options.length; j++) {
        if (!question.options[j].text.trim()) {
          return `Вопрос ${i + 1}, вариант ${j + 1}: введите текст варианта`;
        }
      }
    }
    
    return null;
  };
  
  // Обработчик сохранения
  const handleSave = () => {
    const validationError = validateForm();
    
    if (validationError) {
      toast({
        title: "Ошибка валидации",
        description: validationError,
        variant: "destructive",
      });
      return;
    }
    
    // Формируем данные для отправки
    if (isEditing && testToEdit) {
      // Обновление существующего теста
      updateTestMutation.mutate({
        testId: testToEdit.id,
        test: { title, description },
        questions
      });
    } else {
      // Создание нового теста
      const formattedData = {
        test: { title, description },
        questions: questions.map(q => ({
          question: { text: q.text },
          options: q.options.map(o => ({
            text: o.text,
            isCorrect: o.isCorrect
          }))
        }))
      };
      
      createTestMutation.mutate(formattedData);
    }
  };
  
  // Сброс формы и закрытие модального окна
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setQuestions([
      {
        text: "",
        options: [
          { text: "", isCorrect: false },
          { text: "", isCorrect: false }
        ]
      }
    ]);
    setIsEditing(false);
  };
  
  const handleClose = () => {
    resetForm();
    onClose();
  };
  
  // Эффект для инициализации состояния при открытии модального окна
  useEffect(() => {
    if (isOpen && !testToEdit && questions.length === 0) {
      handleAddQuestion();
    }
  }, [isOpen, testToEdit, questions.length]);
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Редактирование теста" : "Создание нового теста"}</DialogTitle>
        </DialogHeader>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Название теста
          </label>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Введите название теста"
            className="w-full"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Описание (опционально)
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Введите описание теста"
            rows={3}
            className="w-full"
          />
        </div>
        
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white">Вопросы</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddQuestion}
              className="flex items-center text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300"
            >
              <Plus className="w-5 h-5 mr-1" />
              Добавить вопрос
            </Button>
          </div>
          
          {/* Пагинация для вопросов */}
          {questions.length > QUESTIONS_PER_PAGE && (
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Страница {currentPage} из {Math.max(1, Math.ceil(questions.length / QUESTIONS_PER_PAGE))}
                </span>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Назад
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(questions.length / QUESTIONS_PER_PAGE), prev + 1))}
                    disabled={currentPage >= Math.ceil(questions.length / QUESTIONS_PER_PAGE)}
                  >
                    Далее
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* Список вопросов с возможностью редактирования */}
          <div className="space-y-4">
            {questions
              .slice((currentPage - 1) * QUESTIONS_PER_PAGE, currentPage * QUESTIONS_PER_PAGE)
              .map((question, displayIndex) => {
                const questionIndex = (currentPage - 1) * QUESTIONS_PER_PAGE + displayIndex;
                return (
                  <div 
                    key={questionIndex} 
                    className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h5 className="font-medium">Вопрос {questionIndex + 1}</h5>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveQuestion(questionIndex)}
                          className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                          disabled={questions.length <= 1}
                        >
                          <Trash className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Текст вопроса
                      </label>
                      <Input
                        type="text"
                        value={question.text}
                        onChange={(e) => handleQuestionTextChange(questionIndex, e.target.value)}
                        placeholder="Введите вопрос"
                        className="w-full text-sm"
                      />
                    </div>
                    
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Варианты ответов
                      </label>
                      <div className="space-y-2">
                        {question.options.map((option, optionIndex) => (
                          <div key={optionIndex} className="flex items-center space-x-2">
                            <Checkbox
                              id={`answer_${questionIndex}_${optionIndex}`}
                              checked={option.isCorrect}
                              onCheckedChange={(checked) => 
                                handleOptionCorrectChange(questionIndex, optionIndex, checked === true)
                              }
                              className="w-4 h-4"
                            />
                            <Input
                              type="text"
                              value={option.text}
                              onChange={(e) => 
                                handleOptionTextChange(questionIndex, optionIndex, e.target.value)
                              }
                              placeholder="Вариант ответа"
                              className="flex-grow text-sm"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveOption(questionIndex, optionIndex)}
                              className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 p-0"
                              disabled={question.options.length <= 2}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddOption(questionIndex)}
                        className="mt-2 text-xs text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 flex items-center p-0"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Добавить вариант
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
        
        <DialogFooter className="flex justify-end space-x-3">
          <Button variant="outline" onClick={handleClose}>
            Отмена
          </Button>
          <Button 
            onClick={handleSave}
            disabled={createTestMutation.isPending || updateTestMutation.isPending}
            className="flex items-center"
          >
            <Save className="w-4 h-4 mr-2" />
            {createTestMutation.isPending || updateTestMutation.isPending 
              ? "Сохранение..." 
              : "Сохранить тест"
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTestModal;