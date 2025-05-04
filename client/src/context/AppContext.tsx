import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { TestWithQuestions, TestSession } from "@shared/schema";
import { getTestResults, LocalTestResult, saveTestSession, getTestSession, deleteTestSession, getTestStatistics, TestStatistics } from "@/lib/storage";

// Интерфейс контекста приложения
interface AppContextType {
  currentTest: TestWithQuestions | null;
  setCurrentTest: (test: TestWithQuestions | null) => void;
  testSession: TestSession | null;
  setTestSession: (session: TestSession | null) => void;
  saveCurrentSession: () => Promise<void>;
  loadSessionForTest: (testId: number) => Promise<TestSession | null>;
  clearSession: (testId: number) => Promise<void>;
  localResults: LocalTestResult[];
  refreshLocalResults: () => Promise<void>;
  testStatistics: TestStatistics | null;
  loadTestStatistics: (testId: number) => Promise<void>;
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
  const [testStatistics, setTestStatistics] = useState<TestStatistics | null>(null);
  
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
  
  // Функция сохранения текущей сессии
  const saveCurrentSession = async (): Promise<void> => {
    if (testSession && currentTest) {
      try {
        await saveTestSession(testSession.testId, testSession);
      } catch (error) {
        console.error("Ошибка при сохранении сессии:", error);
      }
    }
  };
  
  // Загрузка сессии для теста
  const loadSessionForTest = async (testId: number): Promise<TestSession | null> => {
    try {
      const session = await getTestSession(testId);
      if (session) {
        setTestSession(session);
      }
      return session;
    } catch (error) {
      console.error("Ошибка при загрузке сессии:", error);
      return null;
    }
  };
  
  // Очистка сессии
  const clearSession = async (testId: number): Promise<void> => {
    try {
      await deleteTestSession(testId);
      if (testSession?.testId === testId) {
        setTestSession(null);
      }
    } catch (error) {
      console.error("Ошибка при очистке сессии:", error);
    }
  };
  
  // Загрузка статистики теста
  const loadTestStatistics = async (testId: number): Promise<void> => {
    try {
      const stats = await getTestStatistics(testId);
      setTestStatistics(stats);
    } catch (error) {
      console.error("Ошибка при загрузке статистики теста:", error);
    }
  };
  
  // Значение контекста
  const value: AppContextType = {
    currentTest,
    setCurrentTest,
    testSession,
    setTestSession,
    saveCurrentSession,
    loadSessionForTest,
    clearSession,
    localResults,
    refreshLocalResults,
    testStatistics,
    loadTestStatistics
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
