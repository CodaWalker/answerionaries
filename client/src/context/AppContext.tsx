import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { TestWithQuestions, TestSession } from "@shared/schema";
import { getTestResults, LocalTestResult } from "@/lib/storage";

// Интерфейс контекста приложения
interface AppContextType {
  currentTest: TestWithQuestions | null;
  setCurrentTest: (test: TestWithQuestions | null) => void;
  testSession: TestSession | null;
  setTestSession: (session: TestSession | null) => void;
  localResults: LocalTestResult[];
  refreshLocalResults: () => Promise<void>;
}

// Создание контекста
const AppContext = createContext<AppContextType | undefined>(undefined);

// Свойства провайдера
interface AppProviderProps {
  children: ReactNode;
}

// Провайдер контекста
export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  // Состояния
  const [currentTest, setCurrentTest] = useState<TestWithQuestions | null>(null);
  const [testSession, setTestSession] = useState<TestSession | null>(null);
  const [localResults, setLocalResults] = useState<LocalTestResult[]>([]);
  
  // Загрузка локальных результатов при инициализации
  useEffect(() => {
    refreshLocalResults();
  }, []);
  
  // Функция обновления локальных результатов
  const refreshLocalResults = async (): Promise<void> => {
    try {
      const results = await getTestResults();
      setLocalResults(results);
    } catch (error) {
      console.error("Ошибка при загрузке локальных результатов:", error);
    }
  };
  
  // Значение контекста
  const value: AppContextType = {
    currentTest,
    setCurrentTest,
    testSession,
    setTestSession,
    localResults,
    refreshLocalResults
  };
  
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// Хук для использования контекста
export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  
  if (context === undefined) {
    throw new Error("useAppContext должен использоваться внутри AppProvider");
  }
  
  return context;
};
