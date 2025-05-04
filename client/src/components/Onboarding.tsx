import { useState, useEffect } from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ClipboardList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Onboarding = () => {
  const { toast } = useToast();
  const [showWelcome, setShowWelcome] = useState(false);
  const [runTour, setRunTour] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);

  // Проверка, видел ли пользователь онбординг
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("hasSeenOnboarding");
    if (!hasSeenOnboarding) {
      setShowWelcome(true);
    }
  }, []);

  // Инициализация шагов тура
  useEffect(() => {
    setSteps([
      {
        target: "body", // Первый шаг, просто общее описание
        content: "Добро пожаловать в TestMaster! Давайте познакомимся с основными возможностями приложения.",
        placement: "center",
        disableBeacon: true
      },
      {
        target: ".tab-navigation", // Класс для навигации
        content: "Здесь вы можете переключаться между главной страницей, вашими тестами и результатами",
        placement: "bottom"
      },
      {
        target: ".theme-toggle", // Класс для переключателя темы
        content: "Переключайтесь между светлой и темной темой для комфортной работы",
        placement: "bottom"
      },
      {
        target: ".create-test-btn", // Класс для кнопки создания теста
        content: "Создавайте новые тесты через интуитивно понятный интерфейс",
        placement: "bottom"
      },
      {
        target: ".import-csv-btn", // Класс для кнопки импорта CSV
        content: "Импортируйте тесты из CSV файлов",
        placement: "bottom"
      },
      {
        target: "body",
        content: "Теперь вы знаете основные возможности приложения. Удачного использования!",
        placement: "center"
      }
    ]);
  }, []);

  // Обработчик событий тура
  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type } = data;
    
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      // Тур завершен или пропущен
      setRunTour(false);
      localStorage.setItem("hasSeenOnboarding", "true");
      
      toast({
        title: "Ознакомление завершено",
        description: "Теперь вы можете начать использовать приложение",
      });
    }
  };

  // Обработчик закрытия приветственного экрана
  const handleCloseWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem("hasSeenOnboarding", "true");
  };

  // Обработчик запуска тура
  const handleStartTour = () => {
    setShowWelcome(false);
    setRunTour(true);
  };

  return (
    <>
      {/* Приветственный экран */}
      <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900 dark:text-primary-300 mb-4">
                <ClipboardList className="w-8 h-8" />
              </div>
              <DialogTitle className="text-xl font-bold">
                Добро пожаловать в TestMaster!
              </DialogTitle>
            </div>
          </DialogHeader>
          
          <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
            Простое приложение для создания и прохождения тестов
          </p>
          
          <div className="space-y-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300 mr-3">
                <span className="text-sm font-medium">1</span>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">Создавайте тесты</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Легко создавайте тесты через интерфейс или импортируйте их из CSV файлов
                </p>
              </div>
            </div>
            
            <div className="flex">
              <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 mr-3">
                <span className="text-sm font-medium">2</span>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">Проходите тесты</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Отвечайте на вопросы с одним или несколькими вариантами правильных ответов
                </p>
              </div>
            </div>
            
            <div className="flex">
              <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300 mr-3">
                <span className="text-sm font-medium">3</span>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">Анализируйте результаты</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Отслеживайте свой прогресс и анализируйте результаты прохождения тестов
                </p>
              </div>
            </div>
          </div>
          
          <DialogFooter className="flex space-x-3 sm:space-x-3">
            <Button variant="outline" className="flex-1" onClick={handleCloseWelcome}>
              Пропустить
            </Button>
            <Button className="flex-1" onClick={handleStartTour}>
              Начать знакомство
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Тур по приложению */}
      <Joyride
        steps={steps}
        run={runTour}
        continuous
        showProgress
        showSkipButton
        callback={handleJoyrideCallback}
        styles={{
          options: {
            primaryColor: "#6366f1",
            textColor: "#374151",
            backgroundColor: "#ffffff",
            arrowColor: "#ffffff",
            zIndex: 10000,
          },
          spotlight: {
            backgroundColor: "transparent",
          }
        }}
        locale={{
          back: "Назад",
          close: "Закрыть",
          last: "Завершить",
          next: "Далее",
          skip: "Пропустить"
        }}
      />
    </>
  );
};

export default Onboarding;
