import localforage from 'localforage';

// Инициализация localforage
localforage.config({
  name: 'testmaster',
  storeName: 'testmaster_data',
  description: 'TestMaster application data'
});

// Тип для локального результата теста
export type LocalTestResult = {
  id?: number;
  testId: number;
  testTitle: string;
  score: number;
  totalQuestions: number;
  answers: Record<number, number[]>;
  date: Date;
  timeTaken?: number; // время прохождения в секундах
  isCompleted?: boolean; // завершен ли тест или прерван
};

// Тип для статистики теста
export type TestStatistics = {
  testId: number;
  totalAttempts: number;
  successfulAttempts: number;
  averageScore: number;
  bestScore: number;
  worstScore: number;
  averageTime: number;
  questionStats: Record<number, {
    questionId: number;
    correctCount: number;
    incorrectCount: number;
    totalCount: number;
  }>;
};

// Ключи для хранения данных
const KEYS = {
  TEST_RESULTS: 'test_results',
  TEST_SESSIONS: 'test_sessions',
  TEST_STATISTICS: 'test_statistics',
  CACHED_TESTS: 'cached_tests',
  THEME: 'theme',
  HAS_SEEN_ONBOARDING: 'hasSeenOnboarding',
  LAST_SYNC: 'last_sync'
};

/**
 * Сохранение результата теста
 */
export const saveTestResult = async (result: LocalTestResult): Promise<void> => {
  try {
    // Получаем существующие результаты
    const existingResults = await getTestResults();

    // Генерируем новый ID
    const newId = existingResults.length > 0
      ? Math.max(...existingResults.map(r => r.id || 0)) + 1
      : 1;

    // Сохраняем новый результат
    const newResult = {
      ...result,
      id: newId,
      isCompleted: result.isCompleted !== undefined ? result.isCompleted : true
    };
    await localforage.setItem(KEYS.TEST_RESULTS, [newResult, ...existingResults]);

    // Обновляем статистику теста
    if (result.isCompleted !== false) {
      await updateTestStatistics(newResult);
    }

  } catch (error) {
    console.error('Error saving test result:', error);
    throw new Error('Не удалось сохранить результат теста');
  }
};

/**
 * Получение всех результатов тестов
 */
export const getTestResults = async (): Promise<LocalTestResult[]> => {
  try {
    const results = await localforage.getItem<LocalTestResult[]>(KEYS.TEST_RESULTS);
    return results || [];
  } catch (error) {
    console.error('Error getting test results:', error);
    return [];
  }
};

/**
 * Получение результатов для конкретного теста
 */
export const getTestResultsForTest = async (testId: number): Promise<LocalTestResult[]> => {
  try {
    const allResults = await getTestResults();
    return allResults.filter(result => result.testId === testId);
  } catch (error) {
    console.error('Error getting test results for test:', error);
    return [];
  }
};

/**
 * Удаление результата теста
 */
export const deleteTestResult = async (resultId: number): Promise<boolean> => {
  try {
    const results = await getTestResults();
    const updatedResults = results.filter(result => result.id !== resultId);

    await localforage.setItem(KEYS.TEST_RESULTS, updatedResults);
    return true;
  } catch (error) {
    console.error('Error deleting test result:', error);
    return false;
  }
};

/**
 * Удаление всех результатов для конкретного теста
 */
export const deleteAllTestResultsForTest = async (testId: number): Promise<boolean> => {
  try {
    const results = await getTestResults();
    const updatedResults = results.filter(result => result.testId !== testId);

    await localforage.setItem(KEYS.TEST_RESULTS, updatedResults);
    return true;
  } catch (error) {
    console.error('Error deleting test results for test:', error);
    return false;
  }
};

/**
 * Проверка, видел ли пользователь онбординг
 */
export const hasSeenOnboarding = (): boolean => {
  return localStorage.getItem(KEYS.HAS_SEEN_ONBOARDING) === 'true';
};

/**
 * Установка флага, что пользователь видел онбординг
 */
export const setHasSeenOnboarding = (seen: boolean): void => {
  localStorage.setItem(KEYS.HAS_SEEN_ONBOARDING, seen ? 'true' : 'false');
};

/**
 * Получение выбранной темы
 */
export const getTheme = (): string | null => {
  return localStorage.getItem(KEYS.THEME);
};

/**
 * Установка темы
 */
export const setTheme = (theme: string): void => {
  localStorage.setItem(KEYS.THEME, theme);
};

/**
 * Экспорт результатов в CSV формат
 */
export const exportResultsToCSV = async (): Promise<string> => {
  try {
    const results = await getTestResults();

    if (results.length === 0) {
      throw new Error('Нет результатов для экспорта');
    }

    // Заголовки CSV
    const headers = [
      'ID',
      'Тест ID',
      'Название теста',
      'Баллы',
      'Всего вопросов',
      'Процент',
      'Время (сек)',
      'Завершен',
      'Дата'
    ].join(',');

    // Строки данных
    const rows = results.map(result => {
      const percent = ((result.score / result.totalQuestions) * 100).toFixed(2);
      const date = new Date(result.date).toLocaleString();

      return [
        result.id,
        result.testId,
        `"${result.testTitle.replace(/"/g, '""')}"`,
        result.score,
        result.totalQuestions,
        percent,
        result.timeTaken || 0,
        result.isCompleted !== false ? 'Да' : 'Нет',
        `"${date}"`
      ].join(',');
    });

    // Объединяем все в CSV строку
    return [headers, ...rows].join('\n');

  } catch (error) {
    console.error('Error exporting results to CSV:', error);
    throw new Error('Не удалось экспортировать результаты');
  }
};

/**
 * Сохранение сессии теста
 */
export const saveTestSession = async (testId: number, session: any): Promise<void> => {
  try {
    // Получаем существующие сессии
    const sessions = await localforage.getItem<Record<number, any>>(KEYS.TEST_SESSIONS) || {};

    // Сохраняем сессию для конкретного теста
    sessions[testId] = session;

    await localforage.setItem(KEYS.TEST_SESSIONS, sessions);
  } catch (error) {
    console.error('Error saving test session:', error);
    throw new Error('Не удалось сохранить сессию теста');
  }
};

/**
 * Получение сессии теста
 */
export const getTestSession = async (testId: number): Promise<any | null> => {
  try {
    const sessions = await localforage.getItem<Record<number, any>>(KEYS.TEST_SESSIONS) || {};
    return sessions[testId] || null;
  } catch (error) {
    console.error('Error getting test session:', error);
    return null;
  }
};

/**
 * Удаление сессии теста
 */
export const deleteTestSession = async (testId: number): Promise<boolean> => {
  try {
    const sessions = await localforage.getItem<Record<number, any>>(KEYS.TEST_SESSIONS) || {};

    if (sessions[testId]) {
      delete sessions[testId];
      await localforage.setItem(KEYS.TEST_SESSIONS, sessions);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error deleting test session:', error);
    return false;
  }
};

/**
 * Обновление статистики теста
 */
export const updateTestStatistics = async (result: LocalTestResult): Promise<void> => {
  try {
    const stats = await getTestStatistics(result.testId);
    const score = (result.score / result.totalQuestions) * 100;
    const isSuccessful = score >= 60;

    // Обновляем общие данные
    stats.totalAttempts++;
    if (isSuccessful) stats.successfulAttempts++;

    // Считаем средний балл
    const totalScorePoints = stats.averageScore * (stats.totalAttempts - 1);
    stats.averageScore = (totalScorePoints + score) / stats.totalAttempts;

    // Обновляем лучший/худший результат
    stats.bestScore = Math.max(stats.bestScore, score);
    stats.worstScore = stats.worstScore === 0 ? score : Math.min(stats.worstScore, score);

    // Обновляем среднее время
    if (result.timeTaken) {
      const totalTime = stats.averageTime * (stats.totalAttempts - 1);
      stats.averageTime = (totalTime + result.timeTaken) / stats.totalAttempts;
    }

    // Обновляем статистику по вопросам
    const userAnswers = result.answers;

    // Получаем все вопросы теста с правильными ответами
    try {
      // Запрашиваем тест с API или используем кэшированные данные
      const response = await fetch(`/api/tests/${result.testId}/full`);
      if (response.ok) {
        const testData = await response.json();
        const questions = testData.questions;

        // Обрабатываем каждый вопрос
        for (const question of questions) {
          const questionId = question.id;

          // Создаем запись для вопроса, если ее нет
          if (!stats.questionStats[questionId]) {
            stats.questionStats[questionId] = {
              questionId: questionId,
              correctCount: 0,
              incorrectCount: 0,
              totalCount: 0
            };
          }

          // Получаем правильные ответы для вопроса
          const correctOptionIds = question.options
            .filter((option: any) => option.isCorrect)
            .map((option: any) => option.id);

          // Получаем ответы пользователя для этого вопроса
          const userSelectedOptionIds = userAnswers[questionId] || [];

          // Обновляем счетчики
          stats.questionStats[questionId].totalCount++;

          // Сравниваем ответы (ответ считается правильным, если выбраны все правильные варианты и только они)
          const isCorrect =
            userSelectedOptionIds.length === correctOptionIds.length &&
            userSelectedOptionIds.every(id => correctOptionIds.includes(id));

          if (isCorrect) {
            stats.questionStats[questionId].correctCount++;
          } else {
            stats.questionStats[questionId].incorrectCount++;
          }
        }
      }
    } catch (error) {
      console.error('Error processing question statistics:', error);
    }

    // Сохраняем статистику
    await saveTestStatistics(result.testId, stats);

  } catch (error) {
    console.error('Error updating test statistics:', error);
  }
};

/**
 * Получение статистики по тесту
 */
export const getTestStatistics = async (testId: number): Promise<TestStatistics> => {
  try {
    const allStats = await localforage.getItem<Record<number, TestStatistics>>(KEYS.TEST_STATISTICS) || {};

    // Если статистика для теста существует, возвращаем ее
    if (allStats[testId]) {
      return allStats[testId];
    }

    // Иначе создаем новую статистику
    return {
      testId,
      totalAttempts: 0,
      successfulAttempts: 0,
      averageScore: 0,
      bestScore: 0,
      worstScore: 0,
      averageTime: 0,
      questionStats: {}
    };

  } catch (error) {
    console.error('Error getting test statistics:', error);
    // Возвращаем пустую статистику в случае ошибки
    return {
      testId,
      totalAttempts: 0,
      successfulAttempts: 0,
      averageScore: 0,
      bestScore: 0,
      worstScore: 0,
      averageTime: 0,
      questionStats: {}
    };
  }
};

/**
 * Сохранение статистики теста
 */
export const saveTestStatistics = async (testId: number, stats: TestStatistics): Promise<void> => {
  try {
    const allStats = await localforage.getItem<Record<number, TestStatistics>>(KEYS.TEST_STATISTICS) || {};
    allStats[testId] = stats;
    await localforage.setItem(KEYS.TEST_STATISTICS, allStats);
  } catch (error) {
    console.error('Error saving test statistics:', error);
  }
};

/**
 * Сброс статистики теста
 */
export const resetTestStatistics = async (testId: number): Promise<boolean> => {
  try {
    const allStats = await localforage.getItem<Record<number, TestStatistics>>(KEYS.TEST_STATISTICS) || {};

    if (allStats[testId]) {
      allStats[testId] = {
        testId,
        totalAttempts: 0,
        successfulAttempts: 0,
        averageScore: 0,
        bestScore: 0,
        worstScore: 0,
        averageTime: 0,
        questionStats: {}
      };

      await localforage.setItem(KEYS.TEST_STATISTICS, allStats);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error resetting test statistics:', error);
    return false;
  }
};

/**
 * Кэширование тестов для офлайн-режима
 */
export const cacheTests = async (tests: any[]): Promise<void> => {
  try {
    await localforage.setItem(KEYS.CACHED_TESTS, tests);
    localStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());
  } catch (error) {
    console.error('Error caching tests:', error);
  }
};

/**
 * Получение кэшированных тестов
 */
export const getCachedTests = async (): Promise<any[]> => {
  try {
    const tests = await localforage.getItem<any[]>(KEYS.CACHED_TESTS);
    return tests || [];
  } catch (error) {
    console.error('Error getting cached tests:', error);
    return [];
  }
};

/**
 * Получение кэшированного теста по ID
 */
export const getCachedTest = async (testId: number): Promise<any | null> => {
  try {
    const tests = await getCachedTests();
    return tests.find(test => test.id === testId) || null;
  } catch (error) {
    console.error('Error getting cached test:', error);
    return null;
  }
};

/**
 * Получение времени последней синхронизации тестов
 */
export const getLastSyncTime = (): Date | null => {
  const lastSync = localStorage.getItem(KEYS.LAST_SYNC);
  return lastSync ? new Date(lastSync) : null;
};

/**
 * Очистка всех данных приложения
 */
export const clearAllData = async (): Promise<void> => {
  try {
    await localforage.clear();
    localStorage.removeItem(KEYS.HAS_SEEN_ONBOARDING);
    localStorage.removeItem(KEYS.THEME);
    localStorage.removeItem(KEYS.LAST_SYNC);
  } catch (error) {
    console.error('Error clearing all data:', error);
    throw new Error('Не удалось очистить данные');
  }
};
