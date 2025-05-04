import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import ImportTestModal from "@/components/ImportTestModal";
import CreateTestModal from "@/components/CreateTestModal";
import TestPlayer from "@/components/TestPlayer";
import { apiRequest } from "@/lib/queryClient";
import { type Test } from "@shared/schema";
import { useAppContext } from "@/context/AppContext";
import { getTestResults } from "@/lib/storage";

const StatsDisplay = () => {
  const { localResults } = useAppContext();
  const [stats, setStats] = useState({ completed: 0, averageScore: 0 });
  const { data: testsData } = useQuery<Test[]>({ queryKey: ['/api/tests'] });
  
  useEffect(() => {
    const calculateStats = async () => {
      try {
        const completedResults = localResults.filter(result => result.isCompleted);
        const completed = completedResults.length;
        
        // Если нет завершенных тестов, используем 0
        const averageScore = completed > 0 
          ? Math.round(completedResults.reduce((sum, result) => sum + (result.score / result.totalQuestions * 100), 0) / completed) 
          : 0;
        
        setStats({ completed, averageScore });
      } catch (error) {
        console.error("Ошибка при расчете статистики:", error);
        setStats({ completed: 0, averageScore: 0 });
      }
    };
    
    calculateStats();
  }, [localResults]);
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-gray-600 dark:text-gray-400">Пройдено тестов</span>
        <span className="font-medium">{stats.completed}</span>
      </div>
      <div className="h-px bg-gray-200 dark:bg-gray-700"></div>
      <div className="flex justify-between items-center">
        <span className="text-gray-600 dark:text-gray-400">Средний балл</span>
        <span className="font-medium">{stats.averageScore > 0 ? `${stats.averageScore}%` : '-'}</span>
      </div>
      <div className="h-px bg-gray-200 dark:bg-gray-700"></div>
      <div className="flex justify-between items-center">
        <span className="text-gray-600 dark:text-gray-400">Созданных тестов</span>
        <span className="font-medium">{testsData ? testsData.length : 0}</span>
      </div>
    </div>
  );
};

const HomePage = () => {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { setCurrentTest } = useAppContext();
  
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTestPlayerOpen, setIsTestPlayerOpen] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState<number | null>(null);
  
  // Получение списка тестов
  const { data: tests, isLoading, error } = useQuery<Test[]>({
    queryKey: ['/api/tests'],
  });
  
  // Обработчики для открытия модальных окон
  const handleOpenImportModal = () => setIsImportModalOpen(true);
  const handleOpenCreateModal = () => setIsCreateModalOpen(true);
  
  // Обработчик для запуска теста
  const handleStartTest = async (testId: number) => {
    try {
      const res = await apiRequest('GET', `/api/tests/${testId}/full`);
      const fullTest = await res.json();
      setCurrentTest(fullTest);
      setSelectedTestId(testId);
      setIsTestPlayerOpen(true);
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить тест. Попробуйте позже.",
        variant: "destructive"
      });
    }
  };
  
  // Фильтрация тестов для быстрого доступа (последние 3)
  const recentTests = tests?.slice(0, 3) || [];
  
  return (
    <>
      {/* Приветственный баннер */}
      <div className="bg-gradient-to-r from-primary to-secondary-600 rounded-xl p-6 text-white mb-8 shadow-md">
        <h2 className="text-2xl font-bold mb-2">Добро пожаловать в TestMaster!</h2>
        <p className="mb-4">Создавайте и проходите тесты для проверки знаний легко и быстро.</p>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={handleOpenCreateModal}
            className="bg-white text-primary font-medium py-2 px-4 rounded-lg shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white"
          >
            Создать тест
          </button>
          <button 
            onClick={handleOpenImportModal}
            className="bg-white/20 backdrop-blur-sm text-white font-medium py-2 px-4 rounded-lg shadow-sm hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white"
          >
            Импортировать CSV
          </button>
        </div>
      </div>
      
      {/* Быстрый доступ */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-3">Быстрый доступ</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {isLoading ? (
            // Индикатор загрузки
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full mb-3"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                </CardContent>
              </Card>
            ))
          ) : error ? (
            // Ошибка загрузки
            <div className="col-span-3 text-center py-8">
              <p className="text-red-500">Не удалось загрузить тесты. Попробуйте позже.</p>
            </div>
          ) : recentTests.length === 0 ? (
            // Нет тестов
            <div className="col-span-3 text-center py-8">
              <p className="text-gray-600 dark:text-gray-400">У вас пока нет тестов. Создайте новый или импортируйте из CSV.</p>
            </div>
          ) : (
            // Список тестов
            recentTests.map((test) => (
              <div 
                key={test.id} 
                className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow p-4 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-medium text-primary-600 dark:text-primary-400">{test.title}</h4>
                  <span className="bg-green-100 text-green-800 text-xs font-medium py-0.5 px-2 rounded dark:bg-green-900 dark:text-green-300">
                    {test.questionCount} вопросов
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                  {test.description || "Без описания"}
                </p>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Создан: {new Date(test.createdAt).toLocaleDateString('ru-RU')}
                  </span>
                  <button 
                    onClick={() => handleStartTest(test.id)}
                    className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm font-medium"
                  >
                    Пройти
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* Статистика и информация */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Моя статистика</h3>
          
          <StatsDisplay />
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Советы</h3>
          <ul className="space-y-3 text-gray-600 dark:text-gray-400">
            <li className="flex">
              <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>CSV файлы должны содержать поля: question_id, question, variants</span>
            </li>
            <li className="flex">
              <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Для нескольких правильных ответов укажите их через запятую: 1,2,3</span>
            </li>
            <li className="flex">
              <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Используйте разделитель ";" между колонками в CSV файле</span>
            </li>
          </ul>
        </div>
      </div>
      
      {/* Модальные окна */}
      <ImportTestModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
      />
      
      <CreateTestModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
      />
      
      <TestPlayer 
        isOpen={isTestPlayerOpen} 
        onClose={() => setIsTestPlayerOpen(false)} 
        testId={selectedTestId}
      />
    </>
  );
};

export default HomePage;
