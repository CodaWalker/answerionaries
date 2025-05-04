import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Result, Test } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

// Параметры пагинации
const ITEMS_PER_PAGE = 8;

const ResultsPage = () => {
  const { toast } = useToast();
  
  // Состояния
  const [searchTerm, setSearchTerm] = useState("");
  const [timeFilter, setTimeFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  
  // Получение результатов
  const { data: results = [], isLoading: loadingResults } = useQuery<Result[]>({
    queryKey: ['/api/results'],
  });
  
  // Получение тестов для сопоставления названий
  const { data: tests = [], isLoading: loadingTests } = useQuery<Test[]>({
    queryKey: ['/api/tests'],
  });
  
  // Фильтрация результатов
  const filteredResults = results.filter(result => {
    // Поиск по названию теста
    const test = tests.find(t => t.id === result.testId);
    if (!test || !test.title.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    // Фильтр по времени
    const resultDate = new Date(result.createdAt);
    const currentDate = new Date();
    if (timeFilter === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(currentDate.getDate() - 7);
      if (resultDate < weekAgo) return false;
    } else if (timeFilter === "month") {
      const monthAgo = new Date();
      monthAgo.setMonth(currentDate.getMonth() - 1);
      if (resultDate < monthAgo) return false;
    } else if (timeFilter === "quarter") {
      const quarterAgo = new Date();
      quarterAgo.setMonth(currentDate.getMonth() - 3);
      if (resultDate < quarterAgo) return false;
    }
    
    // Фильтр по проценту правильных ответов
    const scorePercent = (result.score / result.totalQuestions) * 100;
    if (scoreFilter === "high" && scorePercent <= 80) return false;
    if (scoreFilter === "medium" && (scorePercent < 50 || scorePercent > 80)) return false;
    if (scoreFilter === "low" && scorePercent >= 50) return false;
    
    return true;
  });
  
  // Пагинация
  const totalPages = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);
  const paginatedResults = filteredResults.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  
  // Обработчики событий
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };
  
  const handleTimeFilterChange = (value: string) => {
    setTimeFilter(value);
    setCurrentPage(1);
  };
  
  const handleScoreFilterChange = (value: string) => {
    setScoreFilter(value);
    setCurrentPage(1);
  };
  
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };
  
  const handleExportResults = () => {
    // В реальном приложении здесь был бы экспорт в CSV или PDF
    toast({
      title: "Экспорт результатов",
      description: "Функция экспорта в разработке",
    });
  };
  
  const handleViewDetails = async (resultId: number) => {
    try {
      const res = await apiRequest('GET', `/api/results/${resultId}`);
      const resultDetails = await res.json();
      setSelectedResult(resultDetails);
      
      // TODO: В будущем можно реализовать модальное окно с детальным отображением результатов
      toast({
        title: "Просмотр результатов",
        description: "Детальный просмотр результатов в разработке",
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить детали результата",
        variant: "destructive",
      });
    }
  };
  
  // Получение названия теста по ID
  const getTestName = (testId: number) => {
    const test = tests.find(t => t.id === testId);
    return test ? test.title : "Неизвестный тест";
  };
  
  // Отображение процента правильных ответов и цвета прогресс-бара
  const getScoreInfo = (score: number, total: number) => {
    const percent = (score / total) * 100;
    let color = "bg-green-500";
    
    if (percent < 50) {
      color = "bg-red-500";
    } else if (percent < 80) {
      color = "bg-yellow-400";
    }
    
    return { percent, color };
  };
  
  // Отображение пустого состояния
  if (!loadingResults && !loadingTests && filteredResults.length === 0) {
    return (
      <div>
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Результаты тестирования</h2>
          <Button 
            variant="outline" 
            onClick={handleExportResults}
            className="flex items-center gap-2"
            disabled
          >
            <Download size={16} />
            Экспорт результатов
          </Button>
        </div>
        
        {/* Фильтры */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-3 md:space-y-0">
            <div className="relative flex-grow">
              <Input
                type="text"
                placeholder="Поиск по тесту..."
                value={searchTerm}
                onChange={handleSearch}
                className="pl-10"
              />
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            </div>
            
            <div className="flex space-x-3">
              <Select value={timeFilter} onValueChange={handleTimeFilterChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Все периоды" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все периоды</SelectItem>
                  <SelectItem value="week">Последняя неделя</SelectItem>
                  <SelectItem value="month">Последний месяц</SelectItem>
                  <SelectItem value="quarter">Последние 3 месяца</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={scoreFilter} onValueChange={handleScoreFilterChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Все результаты" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все результаты</SelectItem>
                  <SelectItem value="high">Высокие результаты ({'>'}80%)</SelectItem>
                  <SelectItem value="medium">Средние результаты (50-80%)</SelectItem>
                  <SelectItem value="low">Низкие результаты ({'<'}50%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        
        <Card className="w-full text-center py-16">
          <CardContent>
            <h3 className="text-xl font-medium mb-4">У вас пока нет результатов тестирования</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Результаты появятся здесь после прохождения тестов
            </p>
            <Button onClick={() => window.location.href = "/"}>
              Перейти к тестам
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-xl font-semibold">Результаты тестирования</h2>
        <Button 
          variant="outline" 
          onClick={handleExportResults}
          className="flex items-center gap-2"
        >
          <Download size={16} />
          Экспорт результатов
        </Button>
      </div>
      
      {/* Фильтры */}
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-3 md:space-y-0">
          <div className="relative flex-grow">
            <Input
              type="text"
              placeholder="Поиск по тесту..."
              value={searchTerm}
              onChange={handleSearch}
              className="pl-10"
            />
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          </div>
          
          <div className="flex space-x-3">
            <Select value={timeFilter} onValueChange={handleTimeFilterChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Все периоды" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все периоды</SelectItem>
                <SelectItem value="week">Последняя неделя</SelectItem>
                <SelectItem value="month">Последний месяц</SelectItem>
                <SelectItem value="quarter">Последние 3 месяца</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={scoreFilter} onValueChange={handleScoreFilterChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Все результаты" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все результаты</SelectItem>
                <SelectItem value="high">Высокие результаты ({'>'}80%)</SelectItem>
                <SelectItem value="medium">Средние результаты (50-80%)</SelectItem>
                <SelectItem value="low">Низкие результаты ({'<'}50%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* Таблица результатов */}
      <div className="relative overflow-x-auto shadow-md sm:rounded-lg mb-6">
        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-800 dark:text-gray-400">
            <tr>
              <th scope="col" className="px-6 py-3">Название теста</th>
              <th scope="col" className="px-6 py-3">Дата</th>
              <th scope="col" className="px-6 py-3">Верных ответов</th>
              <th scope="col" className="px-6 py-3">Результат</th>
              <th scope="col" className="px-6 py-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {loadingResults || loadingTests ? (
              // Индикатор загрузки
              Array.from({ length: 4 }).map((_, index) => (
                <tr key={index} className="bg-white dark:bg-gray-900 border-b dark:border-gray-700 animate-pulse">
                  <td className="px-6 py-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                  </td>
                </tr>
              ))
            ) : paginatedResults.length > 0 ? (
              paginatedResults.map((result) => {
                const { percent, color } = getScoreInfo(result.score, result.totalQuestions);
                
                return (
                  <tr key={result.id} className="bg-white dark:bg-gray-900 border-b dark:border-gray-700">
                    <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                      {getTestName(result.testId)}
                    </th>
                    <td className="px-6 py-4">
                      {new Date(result.createdAt).toLocaleString('ru-RU')}
                    </td>
                    <td className="px-6 py-4">
                      {`${result.score}/${result.totalQuestions}`}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-2.5 w-full bg-gray-200 rounded-full dark:bg-gray-700 mr-2">
                          <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${percent}%` }}></div>
                        </div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{percent.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleViewDetails(result.id)}
                        className="font-medium text-primary-600 dark:text-primary-500 hover:underline"
                      >
                        Подробнее
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center">
                  Не найдено результатов, соответствующих заданным критериям
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
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
    </div>
  );
};

export default ResultsPage;
