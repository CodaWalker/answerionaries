import Papa from "papaparse";
import { z } from "zod";
import { csvQuestionSchema, csvAnswerSchema, type CsvValidationResult, type CSVQuestion, type CSVAnswer } from "@shared/schema";

/**
 * Функция для парсинга и валидации CSV-файла с вопросами и ответами
 * @param file CSV-файл
 * @returns Объект CsvValidationResult с результатом валидации
 */
export const parseCSV = async (file: File): Promise<CsvValidationResult> => {
  try {
    // Парсим весь файл
    const text = await readFileAsText(file);
    
    // Проверяем, содержит ли файл заголовки вопросов и/или ответов
    const hasQuestionsHeader = text.includes("question_id;question;variants");
    const hasAnswersHeader = text.includes("question_id;answers");
    
    console.log("Найдены заголовки:", { hasQuestionsHeader, hasAnswersHeader });
    
    // Если файл содержит только вопросы
    if (hasQuestionsHeader && !hasAnswersHeader) {
      const questionsResult = parseQuestions(text);
      if (!questionsResult.isValid) {
        return {
          isValid: false,
          error: `Ошибка при парсинге вопросов: ${questionsResult.error}`
        };
      }
      
      return {
        isValid: true,
        questions: questionsResult.questions,
      };
    }
    
    // Если файл содержит только ответы
    if (!hasQuestionsHeader && hasAnswersHeader) {
      const answersResult = parseAnswers(text);
      if (!answersResult.isValid) {
        return {
          isValid: false,
          error: `Ошибка при парсинге ответов: ${answersResult.error}`
        };
      }
      
      return {
        isValid: true,
        answers: answersResult.answers,
      };
    }
    
    // Если файл содержит и вопросы, и ответы
    if (hasQuestionsHeader && hasAnswersHeader) {
      // Разделяем файл на секции
      const sections = separateSections(text);
      
      if (!sections.questionsSection || !sections.answersSection) {
        return {
          isValid: false,
          error: "Не удалось корректно разделить файл на секции вопросов и ответов"
        };
      }
      
      // Парсим секции
      const questionsResult = parseQuestions(sections.questionsSection);
      const answersResult = parseAnswers(sections.answersSection);
      
      // Проверяем наличие ошибок парсинга
      if (!questionsResult.isValid) {
        return {
          isValid: false,
          error: `Ошибка в секции вопросов: ${questionsResult.error}`
        };
      }
      
      if (!answersResult.isValid) {
        return {
          isValid: false,
          error: `Ошибка в секции ответов: ${answersResult.error}`
        };
      }
      
      // Проверяем соответствие вопросов и ответов
      const validationResult = validateQuestionsAndAnswers(
        questionsResult.questions || [],
        answersResult.answers || []
      );
      
      if (!validationResult.isValid) {
        return {
          isValid: false,
          error: validationResult.error
        };
      }
      
      return {
        isValid: true,
        questions: questionsResult.questions,
        answers: answersResult.answers
      };
    }
    
    // Если ни один заголовок не найден
    return {
      isValid: false,
      error: "Файл должен содержать заголовки question_id;question;variants или question_id;answers"
    };
    
  } catch (error) {
    console.error("Ошибка при обработке CSV файла:", error);
    return {
      isValid: false,
      error: `Ошибка при обработке файла: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * Функция для чтения файла как текст
 */
const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error("Не удалось прочитать файл"));
      }
    };
    reader.onerror = () => {
      reject(new Error("Ошибка при чтении файла"));
    };
    reader.readAsText(file);
  });
};

/**
 * Разделение файла на секции вопросов и ответов
 */
const separateSections = (text: string): { questionsSection: string | null; answersSection: string | null } => {
  try {
    // Разделяем файл на строки
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
    
    // Находим индексы заголовков секций
    const questionsHeaderIndex = lines.findIndex(line => line.includes("question_id;question;variants"));
    const answersHeaderIndex = lines.findIndex(line => line.includes("question_id;answers"));
    
    console.log("Заголовки секций:", { questionsHeaderIndex, answersHeaderIndex });
    
    if (questionsHeaderIndex === -1 || answersHeaderIndex === -1) {
      console.error("Не найдены заголовки секций в CSV файле");
      return { questionsSection: null, answersSection: null };
    }
    
    // Получаем строки для каждой секции
    const questionsLines = lines.slice(questionsHeaderIndex, answersHeaderIndex).join("\n");
    const answersLines = lines.slice(answersHeaderIndex).join("\n");
    
    console.log("Количество строк в секциях:", {
      questions: questionsLines.split("\n").length,
      answers: answersLines.split("\n").length
    });
    
    return {
      questionsSection: questionsLines,
      answersSection: answersLines
    };
  } catch (error) {
    console.error("Ошибка при разделении секций:", error);
    return { questionsSection: null, answersSection: null };
  }
};

/**
 * Парсинг секции вопросов
 */
const parseQuestions = (text: string): { isValid: boolean; questions?: CSVQuestion[]; error?: string } => {
  try {
    // Предварительная обработка текста - удаляем все кавычки
    let processedText = text.replace(/"/g, ""); // Удаляем все двойные кавычки из текста
    
    console.log("Исходный текст вопросов (обработанный):", processedText.substring(0, 100));
    
    const result = Papa.parse<CSVQuestion>(processedText, {
      header: true,
      delimiter: ";",
      skipEmptyLines: true,
      dynamicTyping: false  // Отключаем автоматическое преобразование типов
    });
    
    if (result.errors.length > 0) {
      console.error("CSV parsing error:", result.errors);
      return {
        isValid: false,
        error: `Ошибка парсинга: ${result.errors[0].message}`
      };
    }
    
    // Валидация каждого вопроса
    for (const question of result.data) {
      try {
        csvQuestionSchema.parse(question);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return {
            isValid: false,
            error: `Ошибка валидации вопроса ${question.question_id}: ${err.errors[0].message}`
          };
        }
      }
      
      // Проверка вариантов ответов
      if (!question.variants || question.variants.split(',').length < 2) {
        return {
          isValid: false,
          error: `Вопрос ${question.question_id} должен иметь минимум 2 варианта ответа`
        };
      }
    }
    
    // Проверка на дубликаты question_id
    const questionIds = result.data.map(q => q.question_id);
    const uniqueQuestionIds = [...new Set(questionIds)];
    
    if (uniqueQuestionIds.length !== questionIds.length) {
      return {
        isValid: false,
        error: "Найдены дубликаты question_id в секции вопросов"
      };
    }
    
    return {
      isValid: true,
      questions: result.data
    };
    
  } catch (error) {
    return {
      isValid: false,
      error: `Ошибка парсинга секции вопросов: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * Парсинг секции ответов
 */
const parseAnswers = (text: string): { isValid: boolean; answers?: CSVAnswer[]; error?: string } => {
  try {
    // Предварительная обработка текста - удаляем все кавычки
    let processedText = text.replace(/"/g, ""); // Удаляем все двойные кавычки из текста
    
    console.log("Исходный текст ответов (обработанный):", processedText.substring(0, 100));
    
    const result = Papa.parse<CSVAnswer>(processedText, {
      header: true,
      delimiter: ";",
      skipEmptyLines: true,
      dynamicTyping: false  // Отключаем автоматическое преобразование типов
    });
    
    if (result.errors.length > 0) {
      console.error("CSV answers parsing error:", result.errors);
      return {
        isValid: false,
        error: `Ошибка парсинга: ${result.errors[0].message}`
      };
    }
    
    // Валидация каждого ответа
    for (const answer of result.data) {
      try {
        csvAnswerSchema.parse(answer);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return {
            isValid: false,
            error: `Ошибка валидации ответа ${answer.question_id}: ${err.errors[0].message}`
          };
        }
      }
    }
    
    // Проверка на дубликаты question_id
    const answerIds = result.data.map(a => a.question_id);
    const uniqueAnswerIds = [...new Set(answerIds)];
    
    if (uniqueAnswerIds.length !== answerIds.length) {
      return {
        isValid: false,
        error: "Найдены дубликаты question_id в секции ответов"
      };
    }
    
    return {
      isValid: true,
      answers: result.data
    };
    
  } catch (error) {
    return {
      isValid: false,
      error: `Ошибка парсинга секции ответов: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

/**
 * Валидация соответствия вопросов и ответов
 */
const validateQuestionsAndAnswers = (
  questions: CSVQuestion[],
  answers: CSVAnswer[]
): { isValid: boolean; error?: string } => {
  // Проверка наличия ответов для всех вопросов
  const questionIds = questions.map(q => q.question_id);
  const answerIds = answers.map(a => a.question_id);
  
  // Проверка наличия ответа для каждого вопроса
  for (const qId of questionIds) {
    if (!answerIds.includes(qId)) {
      return {
        isValid: false,
        error: `Отсутствует ответ для вопроса с ID ${qId}`
      };
    }
  }
  
  // Проверка на лишние ответы
  for (const aId of answerIds) {
    if (!questionIds.includes(aId)) {
      return {
        isValid: false,
        error: `Найден ответ для несуществующего вопроса с ID ${aId}`
      };
    }
  }
  
  // Проверка валидности ответов
  for (const answer of answers) {
    const question = questions.find(q => q.question_id === answer.question_id);
    if (!question) continue;
    
    const answerIndices = answer.answers.split(',').map(a => parseInt(a.trim()));
    const variantsCount = question.variants.split(',').length;
    
    // Проверка индексов ответов
    for (const idx of answerIndices) {
      if (isNaN(idx) || idx < 1 || idx > variantsCount) {
        return {
          isValid: false,
          error: `Неверный индекс ответа для вопроса ${answer.question_id}: ${idx}. Должен быть от 1 до ${variantsCount}`
        };
      }
    }
    
    // Проверка, что не все варианты отмечены как правильные
    if (answerIndices.length === variantsCount) {
      return {
        isValid: false,
        error: `Для вопроса ${answer.question_id} все варианты отмечены как правильные`
      };
    }
    
    // Проверка, что есть хотя бы один правильный вариант
    if (answerIndices.length === 0) {
      return {
        isValid: false,
        error: `Для вопроса ${answer.question_id} не указан ни один правильный вариант`
      };
    }
  }
  
  return { isValid: true };
};
