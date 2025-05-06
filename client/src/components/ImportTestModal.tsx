import React, { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {parseCSV, readFileAsText} from "@/lib/csv-parser";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { type InsertTest, CSVQuestion, CSVAnswer } from "@shared/schema";

type ImportTestModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const ImportTestModal = ({ isOpen, onClose }: ImportTestModalProps) => {
  const { toast } = useToast();
  const questionsFileInputRef = useRef<HTMLInputElement>(null);
  const answersFileInputRef = useRef<HTMLInputElement>(null);

  // Состояния
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questionsFile, setQuestionsFile] = useState<File | null>(null);
  const [answersFile, setAnswersFile] = useState<File | null>(null);
  const [questionsFileName, setQuestionsFileName] = useState("");
  const [answersFileName, setAnswersFileName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [questionsData, setQuestionsData] = useState<CSVQuestion[] | null>(null);
  const [answersData, setAnswersData] = useState<CSVAnswer[] | null>(null);
  const [step, setStep] = useState<'questions' | 'answers' | 'review'>('questions');
  const [error, setError] = useState<string | null>(null);

  // Мутация для создания теста из CSV
  const importMutation = useMutation<any, Error, {
    test: InsertTest;
    questions: Array<{
      question: { text: string };
      options: Array<{ text: string; isCorrect: boolean }>;
    }>;
  }>({
    mutationFn: async (data) => {
      const response = await apiRequest('POST', '/api/tests/full', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tests'] });
      toast({
        title: "Тест импортирован",
        description: "Тест успешно импортирован из CSV файла",
      });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Ошибка",
        description: "Не удалось импортировать тест. Проверьте формат файла.",
        variant: "destructive",
      });
    }
  });

  // Обработчик выбора файла вопросов
  const handleQuestionsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setQuestionsFile(selectedFile);
      setQuestionsFileName(selectedFile.name);
      setError(null);
    }
  };

  // Обработчик выбора файла ответов
  const handleAnswersFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setAnswersFile(selectedFile);
      setAnswersFileName(selectedFile.name);
      setError(null);
    }
  };

  // Обработчик перетаскивания файла вопросов
  const handleQuestionsFileDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setQuestionsFile(droppedFile);
      setQuestionsFileName(droppedFile.name);
      setError(null);
    }
  };

  // Обработчик перетаскивания файла ответов
  const handleAnswersFileDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setAnswersFile(droppedFile);
      setAnswersFileName(droppedFile.name);
      setError(null);
    }
  };

  // Предотвращаем стандартное поведение перетаскивания
  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
  };

  // Обработчик загрузки файла вопросов
  const handleProcessQuestionsFile = async () => {
    if (!questionsFile) {
      setError("Выберите файл с вопросами");
      return;
    }

    if (!title.trim()) {
      setError("Введите название теста");
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      // Здесь мы используем parseCSV для парсинга вопросов
      const result = await parseCSV(questionsFile);

      if (!result.isValid || !result.questions) {
        setError(result.error || "Некорректный формат файла с вопросами");
        return;
      }

      setQuestionsData(result.questions);
      setStep('answers');

      toast({
        title: "Вопросы загружены",
        description: `Успешно загружено ${result.questions.length} вопросов`,
      });

    } catch (error) {
      console.error("Questions parsing error:", error);
      setError("Произошла ошибка при обработке файла с вопросами");
    } finally {
      setIsProcessing(false);
    }
  };

  // Обработчик загрузки файла ответов
  const handleProcessAnswersFile = async () => {
    if (!answersFile) {
      setError("Выберите файл с ответами");
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      console.log('Обработка файла с ответами:', answersFile.name);
      const fileContent = await readFileAsText(answersFile);

      // Проверяем, что в файле есть заголовок для ответов
      if (!fileContent.includes("question_id;answers")) {
        const errorMessage = "В файле ответов отсутствует заголовок 'question_id;answers'. Убедитесь, что вы загрузили правильный файл ответов.";
        console.error('Ошибка парсинга ответов:', errorMessage);
        setError(errorMessage);
        return;
      }

      const result = await parseCSV(answersFile);
      console.log('Результат парсинга ответов:', result);

      if (!result.isValid || !result.answers) {
        const errorMessage = result.error || "Некорректный формат файла с ответами";
        console.error('Ошибка парсинга ответов:', errorMessage);
        setError(errorMessage);
        return;
      }

      setAnswersData(result.answers);
      setStep('review');

      toast({
        title: "Ответы загружены",
        description: `Успешно загружено ${result.answers.length} наборов ответов`,
      });

    } catch (error) {
      console.error("Answers parsing error:", error);
      setError("Произошла ошибка при обработке файла с ответами");
    } finally {
      setIsProcessing(false);
    }
  };

  // Обработчик финального импорта
  const handleFinalImport = () => {
    if (!questionsData || !answersData) {
      setError("Отсутствуют данные вопросов или ответов");
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      // Проверка соответствия количества вопросов и ответов
      const questionIds = questionsData.map(q => q.question_id);
      const answerIds = answersData.map(a => a.question_id);
      const missedQuestions = questionIds.filter(qId => !answerIds.includes(qId));
      const extraAnswers = answerIds.filter(aId => !questionIds.includes(aId));

      // Если есть вопросы без ответов
      if (missedQuestions.length > 0) {
        setError(`Отсутствуют ответы для вопросов с ID: ${missedQuestions.join(', ')}`);
        return;
      }

      // Если есть ответы без вопросов
      if (extraAnswers.length > 0) {
        setError(`Найдены ответы для несуществующих вопросов с ID: ${extraAnswers.join(', ')}`);
        return;
      }

      // Преобразуем данные в формат, подходящий для API
      const questionData = questionsData.map(q => {
        const questionId = q.question_id;
        const questionText = q.question;
        const variants = q.variants.split(',').map(v => v.trim());

        // Ищем ответы для этого вопроса
        const answerItem = answersData.find(a => a.question_id === questionId);
        const correctAnswers = answerItem ? answerItem.answers.split(',').map(a => Number(a.trim())) : [];

        // Проверка корректности индексов ответов
        for (const answerIdx of correctAnswers) {
          if (isNaN(answerIdx) || answerIdx < 1 || answerIdx > variants.length) {
            setError(`Неверный индекс ответа ${answerIdx} для вопроса ${questionId}. Должен быть от 1 до ${variants.length}`);
            return null;
          }
        }

        // Проверка, что есть хотя бы один правильный ответ
        if (correctAnswers.length === 0) {
          setError(`Для вопроса ${questionId} не указан ни один правильный вариант ответа`);
          return null;
        }

        // Проверка, что не все варианты отмечены как правильные
        if (correctAnswers.length === variants.length) {
          setError(`Для вопроса ${questionId} все варианты отмечены как правильные`);
          return null;
        }

        // Создаем опции с указанием правильных ответов
        const options = variants.map((text, index) => ({
          text,
          isCorrect: correctAnswers.includes(index + 1)
        }));

        return {
          question: { text: questionText },
          options
        };
      });

      // Проверяем, что нет никаких ошибок в вопросах
      if (questionData.includes(null)) {
        return; // Ошибка уже установлена в setError выше
      }

      // Удаляем все null значения из массива вопросов
      const validQuestionData = questionData.filter(question => question !== null) as {
        question: { text: string };
        options: { text: string; isCorrect: boolean }[];
      }[];

      const testData = {
        test: { title, description },
        questions: validQuestionData
      };

      // Отправляем данные на сервер
      importMutation.mutate(testData);

    } catch (error) {
      console.error("Import error:", error);
      setError("Произошла ошибка при импорте теста");
    } finally {
      setIsProcessing(false);
    }
  };

  // Очистка и закрытие модального окна
  const handleClose = () => {
    setTitle("");
    setDescription("");
    setQuestionsFile(null);
    setAnswersFile(null);
    setQuestionsFileName("");
    setAnswersFileName("");
    setQuestionsData(null);
    setAnswersData(null);
    setStep('questions');
    setError(null);
    onClose();
  };

  // Переход к предыдущему шагу
  const handlePrevStep = () => {
    if (step === 'answers') {
      setStep('questions');
    } else if (step === 'review') {
      setStep('answers');
    }
  };

  // рендер компонента
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Импорт теста из CSV</DialogTitle>
          <div className="mt-2 flex justify-center">
            <div className="flex items-center space-x-2">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step === 'questions' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                <FileText className="w-4 h-4" />
              </div>
              <div className="h-0.5 w-8 bg-muted" />
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step === 'answers' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                <FileText className="w-4 h-4" />
              </div>
              <div className="h-0.5 w-8 bg-muted" />
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step === 'review' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-600 dark:text-red-400 text-sm">
            <div className="font-medium mb-1">Ошибка импорта:</div>
            <div>{error}</div>
          </div>
        )}

        {step === 'questions' && (
          <>
            <div className="mb-4">
              <Label htmlFor="title" className="block text-sm font-medium mb-2">
                Название теста
              </Label>
              <Input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Введите название теста"
                className="w-full"
              />
            </div>

            <div className="mb-4">
              <Label htmlFor="description" className="block text-sm font-medium mb-2">
                Описание (опционально)
              </Label>
              <Input
                id="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Введите описание теста"
                className="w-full"
              />
            </div>

            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2">Файл с вопросами</h3>
              <div className="flex items-center justify-center w-full">
                <Label
                  htmlFor="questions-file-upload"
                  className="flex flex-col items-center justify-center w-full h-28 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-600 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500"
                  onDrop={handleQuestionsFileDrop}
                  onDragOver={handleDragOver}
                >
                  <div className="flex flex-col items-center justify-center pt-4 pb-4">
                    <Upload className="w-6 h-6 mb-2 text-gray-500 dark:text-gray-400" />
                    {questionsFileName ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Выбран файл: <span className="font-semibold">{questionsFileName}</span>
                      </p>
                    ) : (
                      <>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          <span className="font-semibold">Загрузите файл с вопросами</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">CSV файл (формат: question_id;question;variants)</p>
                      </>
                    )}
                  </div>
                  <input
                    ref={questionsFileInputRef}
                    id="questions-file-upload"
                    type="file"
                    className="hidden"
                    accept=".csv"
                    onChange={handleQuestionsFileChange}
                  />
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Отмена
              </Button>
              <Button
                onClick={handleProcessQuestionsFile}
                disabled={!questionsFile || isProcessing}
              >
                {isProcessing ? "Обработка..." : "Далее"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'answers' && (
          <>
            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <h3 className="text-sm font-medium">Информация о тесте</h3>
              </div>
              <div className="bg-muted/50 p-3 rounded-md">
                <p className="font-medium">{title}</p>
                {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
                <div className="mt-2">
                  <p className="text-sm"><span className="text-muted-foreground">Вопросов:</span> {questionsData?.length}</p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2">Файл с ответами</h3>
              <div className="flex items-center justify-center w-full">
                <Label
                  htmlFor="answers-file-upload"
                  className="flex flex-col items-center justify-center w-full h-28 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-600 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500"
                  onDrop={handleAnswersFileDrop}
                  onDragOver={handleDragOver}
                >
                  <div className="flex flex-col items-center justify-center pt-4 pb-4">
                    <Upload className="w-6 h-6 mb-2 text-gray-500 dark:text-gray-400" />
                    {answersFileName ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Выбран файл: <span className="font-semibold">{answersFileName}</span>
                      </p>
                    ) : (
                      <>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          <span className="font-semibold">Загрузите файл с ответами</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">CSV файл (формат: question_id;answers)</p>
                      </>
                    )}
                  </div>
                  <input
                    ref={answersFileInputRef}
                    id="answers-file-upload"
                    type="file"
                    className="hidden"
                    accept=".csv"
                    onChange={handleAnswersFileChange}
                  />
                </Label>
              </div>
            </div>

            <DialogFooter className="flex justify-between">
              <Button variant="outline" onClick={handlePrevStep}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Назад
              </Button>
              <Button
                onClick={handleProcessAnswersFile}
                disabled={!answersFile || isProcessing}
              >
                {isProcessing ? "Обработка..." : "Далее"}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'review' && (
          <>
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2">Проверьте данные перед импортом</h3>
              <div className="bg-muted/50 p-3 rounded-md">
                <p className="font-medium">{title}</p>
                {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
                <Separator className="my-2" />
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm"><span className="text-muted-foreground">Вопросов:</span> {questionsData?.length}</p>
                  </div>
                  <div>
                    <p className="text-sm"><span className="text-muted-foreground">Ответов:</span> {answersData?.length}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md border border-green-200 dark:border-green-800">
                <div className="flex">
                  <CheckCircle2 className="text-green-500 w-5 h-5 mr-2 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-300">Данные готовы к импорту</p>
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">Нажмите кнопку "Импортировать", чтобы завершить процесс.</p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex justify-between">
              <Button variant="outline" onClick={handlePrevStep}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Назад
              </Button>
              <Button
                onClick={handleFinalImport}
                disabled={isProcessing || importMutation.isPending}
              >
                {isProcessing || importMutation.isPending ? "Обработка..." : "Импортировать"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImportTestModal;
