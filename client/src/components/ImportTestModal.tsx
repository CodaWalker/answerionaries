import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { parseCSV } from "@/lib/csv-parser";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CsvValidationResult, type InsertTest } from "@shared/schema";

type ImportTestModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const ImportTestModal = ({ isOpen, onClose }: ImportTestModalProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Состояния
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<CsvValidationResult | null>(null);
  
  // Мутация для создания теста из CSV
  const importMutation = useMutation({
    mutationFn: async (data: {
      test: InsertTest;
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
  
  // Обработчик выбора файла
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setValidationResult(null);
    }
  };
  
  // Обработчик перетаскивания файла
  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setFileName(droppedFile.name);
      setValidationResult(null);
    }
  };
  
  // Предотвращаем стандартное поведение перетаскивания
  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
  };
  
  // Обработчик импорта
  const handleImport = async () => {
    if (!file) {
      toast({
        title: "Выберите файл",
        description: "Пожалуйста, выберите CSV файл для импорта",
        variant: "destructive",
      });
      return;
    }
    
    if (!title.trim()) {
      toast({
        title: "Введите название",
        description: "Пожалуйста, введите название теста",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsValidating(true);
      
      // Парсим и валидируем CSV
      const result = await parseCSV(file);
      setValidationResult(result);
      
      if (!result.isValid || !result.questions || !result.answers) {
        toast({
          title: "Ошибка валидации",
          description: result.error || "Некорректный формат CSV файла",
          variant: "destructive",
        });
        setIsValidating(false);
        return;
      }
      
      // Преобразуем данные в формат, подходящий для API
      const questionData = result.questions.map(q => {
        const questionId = q.question_id;
        const questionText = q.question;
        const variants = q.variants.split(',');
        
        // Ищем ответы для этого вопроса
        const answerItem = result.answers?.find(a => a.question_id === questionId);
        const correctAnswers = answerItem ? answerItem.answers.split(',').map(Number) : [];
        
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
      
      const testData = {
        test: { title, description },
        questions: questionData
      };
      
      // Отправляем данные на сервер
      importMutation.mutate(testData);
      
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Ошибка импорта",
        description: "Произошла ошибка при обработке файла",
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };
  
  // Очистка и закрытие модального окна
  const handleClose = () => {
    setTitle("");
    setDescription("");
    setFile(null);
    setFileName("");
    setValidationResult(null);
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Импорт теста из CSV</DialogTitle>
        </DialogHeader>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Файл должен быть в формате CSV и соответствовать требуемой структуре. Пример структуры:
          </p>
          <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg text-xs font-mono overflow-x-auto mb-4">
            <p>question_id;question;variants</p>
            <p>1;Нозология – это;учение о причинах возникновения болезни,учение об условиях возникновения болезни,общее учение о болезни,учение о механизмах развития болезни</p>
            <p>...</p>
            <p>question_id;answers</p>
            <p>1;3</p>
            <p>2;1,2</p>
          </div>
        </div>
        
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
        
        <div className="mb-5">
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
        
        <div className="mb-5">
          <Label htmlFor="file" className="block text-sm font-medium mb-2">
            Загрузить файл
          </Label>
          <div className="flex items-center justify-center w-full">
            <Label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-600 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-3 text-gray-500 dark:text-gray-400" />
                {fileName ? (
                  <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
                    Выбран файл: <span className="font-semibold">{fileName}</span>
                  </p>
                ) : (
                  <>
                    <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-semibold">Нажмите для загрузки</span> или перетащите файл
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">CSV файл (макс. 10MB)</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                id="file-upload"
                type="file"
                className="hidden"
                accept=".csv"
                onChange={handleFileChange}
              />
            </Label>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Отмена
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!file || isValidating || importMutation.isPending}
          >
            {isValidating || importMutation.isPending ? "Обработка..." : "Импортировать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportTestModal;
