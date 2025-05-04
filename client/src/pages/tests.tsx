import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Upload, List, Grid2X2, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Test, TestWithQuestions } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { deleteAllTestResultsForTest } from "@/lib/storage";
import ImportTestModal from "@/components/ImportTestModal";
import CreateTestModal from "@/components/CreateTestModal";
import TestPlayer from "@/components/TestPlayer";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppContext } from "@/context/AppContext";

// Параметры пагинации
const ITEMS_PER_PAGE = 6;

const TestsPage = () => {
  const { toast } = useToast();
  const { setCurrentTest, loadSessionForTest, testSession, loadTestStatistics, resetTestStatistics } = useAppContext();
  
  // Состояния
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTestPlayerOpen, setIsTestPlayerOpen] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState<number | null>(null);
  const [testToDelete, setTestToDelete] = useState<Test | null>(null);
  const [testToEdit, setTestToEdit] = useState<TestWithQuestions | null>(null);
  const [resumeSessionOpen, setResumeSessionOpen] = useState(false);
  const [testSessionToResume, setTestSessionToResume] = useState<any>(null);
  
  // Получение списка тестов
  const { data: tests = [], isLoading, error } = useQuery<Test[]>({
    queryKey: ['/api/tests'],
  });
  
  // Мутация для удаления теста
  const deleteTestMutation = useMutation({
    mutationFn: async (testId: number) => {
      await apiRequest('DELETE', `/api/tests/${testId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tests'] });
      toast({
        title: "Успешно",
        description: "Тест был удален",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить тест",
        variant: "destructive",
      });
    }
  });
  
  // Фильтрация и сортировка тестов
  const filteredTests = tests
    .filter(test => test.title.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      switch (sortOption) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "questions":
          return b.questionCount - a.questionCount;
        default:
          return 0;
      }
    });
  
  // Пагинация
  const totalPages = Math.ceil(filteredTests.length / ITEMS_PER_PAGE);
  const paginatedTests = filteredTests.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  
  // Обработчики событий
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Сбрасываем на первую страницу при поиске
  };
  
  const handleSortChange = (value: string) => {
    setSortOption(value);
  };
  
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  const handleDeleteTest = (test: Test) => {
    setTestToDelete(test);
  };
  
  const confirmDeleteTest = () => {
    if (testToDelete) {
      // Проверяем, является ли элемент последним на странице
      const isLastOnPage = paginatedTests.length === 1;
      // Проверяем, находимся ли мы на последней странице
      const isLastPage = currentPage === totalPages;
      const testId = testToDelete.id;
      
      // Перед удалением теста удаляем все его результаты и сбрасываем статистику
      Promise.all([
        deleteAllTestResultsForTest(testId),
        resetTestStatistics(testId)
      ]).then(() => {
        // Теперь удаляем сам тест
        deleteTestMutation.mutate(testId, {
          onSuccess: () => {
            // Если это был последний элемент на последней странице и не первая страница,
            // переходим на предыдущую страницу
            if (isLastOnPage && isLastPage && currentPage > 1) {
              setCurrentPage(currentPage - 1);
            }
            
            toast({
              title: "Тест удален",
              description: "Тест, его результаты и статистика были успешно удалены",
            });
          }
        });
      }).catch(error => {
        console.error("Ошибка при очистке данных теста:", error);
        // Удаляем тест даже если не удалось очистить результаты
        deleteTestMutation.mutate(testId);
      });
      
      setTestToDelete(null);
    }
  };
  
  const handleEditTest = async (test: Test) => {
    try {
      const res = await apiRequest('GET', `/api/tests/${test.id}/full`);
      const fullTest = await res.json() as TestWithQuestions;
      setTestToEdit(fullTest);
      setIsCreateModalOpen(true);
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить тест для редактирования",
        variant: "destructive"
      });
    }
  };
  
  // Обработчик сброса статистики теста
  const handleResetStatistics = async (testId: number) => {
    try {
      const success = await resetTestStatistics(testId);
      if (success) {
        // Удаляем все результаты для этого теста
        await deleteAllTestResultsForTest(testId);
        toast({
          title: "Статистика сброшена",
          description: "Статистика и результаты теста успешно сброшены",
        });
      } else {
        toast({
          title: "Ошибка",
          description: "Не удалось сбросить статистику теста",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Ошибка при сбросе статистики:", error);
      toast({
        title: "Ошибка",
        description: "Не удалось сбросить статистику теста",
        variant: "destructive"
      });
    }
  };
  
  const handleStartTest = async (testId: number) => {
    try {
      const res = await apiRequest('GET', `/api/tests/${testId}/full`);
      const fullTest = await res.json();
      setCurrentTest(fullTest);
      setSelectedTestId(testId);
      
      // Проверяем, есть ли сохраненная сессия
      const session = await loadSessionForTest(testId);
      
      if (session && session.isPaused) {
        setTestSessionToResume(session);
        setResumeSessionOpen(true);
      } else {
        // Если нет сессии или она не на паузе, открываем тест как обычно
        setIsTestPlayerOpen(true);
      }
      
      // Загружаем статистику теста
      await loadTestStatistics(testId);
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить тест",
        variant: "destructive"
      });
    }
  };
  
  // Отображение пустого состояния
  if (!isLoading && filteredTests.length === 0) {
    return (
      <div>
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Мои тесты</h2>
          <div className="flex space-x-3">
            <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 bg-primary">
              <Plus size={16} />
              Создать тест
            </Button>
            <Button onClick={() => setIsImportModalOpen(true)} variant="outline" className="flex items-center gap-2">
              <Upload size={16} />
              Импорт
            </Button>
          </div>
        </div>
        
        <Card className="w-full text-center py-16">
          <CardContent>
            <h3 className="text-xl font-medium mb-4">У вас пока нет тестов</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Создайте свой первый тест или импортируйте существующий из CSV файла
            </p>
            <div className="flex justify-center gap-4">
              <Button onClick={() => setIsCreateModalOpen(true)}>
                Создать тест
              </Button>
              <Button onClick={() => setIsImportModalOpen(true)} variant="outline">
                Импортировать CSV
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <ImportTestModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
        <CreateTestModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
      </div>
    );
  }
  
  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-xl font-semibold">Мои тесты</h2>
        <div className="flex space-x-3">
          <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 bg-primary">
            <Plus size={16} />
            Создать тест
          </Button>
          <Button onClick={() => setIsImportModalOpen(true)} variant="outline" className="flex items-center gap-2">
            <Upload size={16} />
            Импорт
          </Button>
        </div>
      </div>
      
      {/* Поиск и фильтрация */}
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-3 md:space-y-0">
          <div className="relative flex-grow">
            <Input
              type="text"
              placeholder="Поиск тестов..."
              value={searchTerm}
              onChange={handleSearch}
              className="pl-10"
            />
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          </div>
          
          <div className="flex space-x-3">
            <Select value={sortOption} onValueChange={handleSortChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Сортировка" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">По дате (новые)</SelectItem>
                <SelectItem value="oldest">По дате (старые)</SelectItem>
                <SelectItem value="questions">По количеству вопросов</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="inline-flex rounded-md shadow-sm" role="group">
              <Button 
                variant={viewMode === "list" ? "default" : "outline"} 
                className="rounded-l-lg rounded-r-none"
                onClick={() => setViewMode("list")}
              >
                <List className="w-5 h-5" />
              </Button>
              <Button 
                variant={viewMode === "grid" ? "default" : "outline"} 
                className="rounded-r-lg rounded-l-none"
                onClick={() => setViewMode("grid")}
              >
                <Grid2X2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Список тестов */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="animate-pulse">
              <CardContent className="p-5">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
                <div className="flex gap-2 mb-4">
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                </div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6 mb-4"></div>
                <div className="flex justify-end">
                  <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-24 mr-2"></div>
                  <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="p-8 text-center text-red-500">
          <CardContent>
            Не удалось загрузить тесты. Пожалуйста, попробуйте позднее.
          </CardContent>
        </Card>
      ) : (
        <div className={`${viewMode === "grid" ? "grid grid-cols-1 lg:grid-cols-2 gap-4" : "space-y-4"} mb-6`}>
          {paginatedTests.map((test) => (
            <Card key={test.id} className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{test.title}</h3>
                  <div className="flex space-x-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="p-1 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
                      onClick={() => handleEditTest(test)}
                    >
                      <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                      onClick={() => handleDeleteTest(test)}
                    >
                      <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </Button>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                    {test.questionCount} вопросов
                  </Badge>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                    Создан: {new Date(test.createdAt).toLocaleDateString('ru-RU')}
                  </Badge>
                  {/* Здесь может быть бейдж с количеством прохождений, но пока его нет в данных */}
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {test.description || "Без описания"}
                </p>
                
                <div className="flex justify-end">
                  <Button 
                    onClick={() => handleStartTest(test.id)} 
                    className="mr-2"
                  >
                    Пройти
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleEditTest(test)}
                    className="mr-2"
                  >
                    Редактировать
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleResetStatistics(test.id)}
                    className="text-amber-600 border-amber-600 hover:text-amber-700 hover:border-amber-700"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Сброс
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <nav aria-label="Pagination" className="mt-4">
            <ul className="flex items-center -space-x-px h-8 text-sm">
              <li>
                <Button
                  variant="outline"
                  className="rounded-l-lg border-r-0"
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </li>
              
              {Array.from({ length: totalPages }).map((_, index) => (
                <li key={index}>
                  <Button
                    variant={currentPage === index + 1 ? "default" : "outline"}
                    className={`rounded-none border-r-0 ${
                      currentPage === index + 1 
                        ? "z-10 bg-primary border-primary" 
                        : ""
                    }`}
                    onClick={() => handlePageChange(index + 1)}
                  >
                    {index + 1}
                  </Button>
                </li>
              ))}
              
              <li>
                <Button
                  variant="outline"
                  className="rounded-r-lg"
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                >
                  <span className="sr-only">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </li>
            </ul>
          </nav>
        </div>
      )}
      
      {/* Модальные окна */}
      <ImportTestModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
      />
      
      <CreateTestModal 
        isOpen={isCreateModalOpen} 
        onClose={() => {
          setIsCreateModalOpen(false);
          setTestToEdit(null);
        }} 
        testToEdit={testToEdit}
      />
      
      <TestPlayer 
        isOpen={isTestPlayerOpen} 
        onClose={() => setIsTestPlayerOpen(false)} 
        testId={selectedTestId}
        resumeSession={testSessionToResume}
      />
      
      {/* Диалог восстановления сессии */}
      <AlertDialog open={resumeSessionOpen} onOpenChange={setResumeSessionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Обнаружена сохраненная сессия</AlertDialogTitle>
            <AlertDialogDescription>
              У вас есть незавершенный тест. Хотите продолжить с того места, где остановились, или начать заново?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline"
              onClick={() => {
                setTestSessionToResume(null);
                setResumeSessionOpen(false);
              }} 
              className="sm:mr-auto text-gray-500 border-gray-300"
            >
              Выйти
            </Button>
            <AlertDialogCancel 
              onClick={() => {
                setTestSessionToResume(null);
                setIsTestPlayerOpen(true);
              }}
            >
              Начать заново
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setIsTestPlayerOpen(true);
            }}>
              Продолжить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Диалог подтверждения удаления */}
      <AlertDialog open={!!testToDelete} onOpenChange={() => setTestToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Тест "{testToDelete?.title}" будет удален вместе со всеми вопросами и результатами.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteTest}
              className="bg-red-500 hover:bg-red-600"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TestsPage;
