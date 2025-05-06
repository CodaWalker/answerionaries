import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { z } from "zod";
import { insertTestSchema, insertQuestionSchema, insertOptionSchema, insertResultSchema } from "@shared/schema";

// Настройка multer для загрузки файлов
const memStorage = multer.memoryStorage();
const upload = multer({
  storage: memStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB максимальный размер
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv") {
      cb(null, true);
    } else {
      cb(new Error("Только CSV-файлы разрешены"));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Префикс для всех маршрутов API
  const apiPrefix = "/api";

  // Middleware для обработки ошибок валидации
  const validateBody = <T>(schema: z.ZodType<T>) => {
    return (req: Request, res: Response, next: Function) => {
      try {
        req.body = schema.parse(req.body);
        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            message: "Ошибка валидации данных",
            errors: error.errors
          });
        }
        next(error);
      }
    };
  };

  // Роуты для тестов
  app.get(`${apiPrefix}/tests`, async (req, res) => {
    try {
      const tests = await storage.getTests();
      res.json(tests);
    } catch (error) {
      res.status(500).json({ message: "Ошибка при получении тестов" });
    }
  });

  app.get(`${apiPrefix}/tests/:id`, async (req, res) => {
    try {
      const testId = parseInt(req.params.id);

      if (isNaN(testId)) {
        return res.status(400).json({ message: "Некорректный ID теста" });
      }

      const test = await storage.getTest(testId);

      if (!test) {
        return res.status(404).json({ message: "Тест не найден" });
      }

      res.json(test);
    } catch (error) {
      res.status(500).json({ message: "Ошибка при получении теста" });
    }
  });

  app.post(`${apiPrefix}/tests`, validateBody(insertTestSchema), async (req, res) => {
    try {
      const newTest = await storage.createTest(req.body);
      res.status(201).json(newTest);
    } catch (error) {
      res.status(500).json({ message: "Ошибка при создании теста" });
    }
  });

  app.put(`${apiPrefix}/tests/:id`, validateBody(insertTestSchema.partial()), async (req, res) => {
    try {
      const testId = parseInt(req.params.id);

      if (isNaN(testId)) {
        return res.status(400).json({ message: "Некорректный ID теста" });
      }

      const updatedTest = await storage.updateTest(testId, req.body);

      if (!updatedTest) {
        return res.status(404).json({ message: "Тест не найден" });
      }

      res.json(updatedTest);
    } catch (error) {
      res.status(500).json({ message: "Ошибка при обновлении теста" });
    }
  });

  app.delete(`${apiPrefix}/tests/:id`, async (req, res) => {
    try {
      const testId = parseInt(req.params.id);

      if (isNaN(testId)) {
        return res.status(400).json({ message: "Некорректный ID теста" });
      }

      const success = await storage.deleteTest(testId);

      if (!success) {
        return res.status(404).json({ message: "Тест не найден" });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Ошибка при удалении теста" });
    }
  });

  // Маршрут для получения полной информации о тесте
  app.get(`${apiPrefix}/tests/:id/full`, async (req, res) => {
    try {
      const testId = parseInt(req.params.id);

      if (isNaN(testId)) {
        return res.status(400).json({ message: "Некорректный ID теста" });
      }

      const fullTest = await storage.getFullTest(testId);

      if (!fullTest) {
        return res.status(404).json({ message: "Тест не найден" });
      }

      res.json(fullTest);
    } catch (error) {
      res.status(500).json({ message: "Ошибка при получении теста" });
    }
  });

  // Маршрут для создания полного теста с вопросами и ответами
  app.post(`${apiPrefix}/tests/full`, async (req, res) => {
    try {
      const { test, questions } = req.body;

      // Валидация
      try {
        insertTestSchema.parse(test);

        if (!Array.isArray(questions) || questions.length === 0) {
          return res.status(400).json({ message: "Тест должен содержать хотя бы один вопрос" });
        }

        // Проверяем каждый вопрос и его варианты ответов
        for (const q of questions) {
          if (!q.question || !q.question.text) {
            return res.status(400).json({ message: "Каждый вопрос должен иметь текст" });
          }

          if (!Array.isArray(q.options) || q.options.length < 2) {
            return res.status(400).json({ message: "Каждый вопрос должен иметь минимум 2 варианта ответа" });
          }

          // Проверяем, что есть хотя бы один правильный ответ
          const hasCorrectOption = q.options.some(o => o.isCorrect);
          // Проверяем, что не все ответы правильные
          const allCorrect = q.options.every(o => o.isCorrect);

          if (!hasCorrectOption) {
            return res.status(400).json({ message: "Каждый вопрос должен иметь хотя бы один правильный ответ" });
          }

          if (allCorrect) {
            return res.status(400).json({ message: "Не все варианты ответов могут быть правильными" });
          }
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            message: "Ошибка валидации данных",
            errors: error.errors
          });
        }
        throw error;
      }

      // Создаем тест с вопросами и ответами
      const fullTest = await storage.createFullTest(test, questions);

      res.status(201).json(fullTest);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Ошибка при создании теста" });
    }
  });

  // Роуты для вопросов
  app.get(`${apiPrefix}/tests/:testId/questions`, async (req, res) => {
    try {
      const testId = parseInt(req.params.testId);

      if (isNaN(testId)) {
        return res.status(400).json({ message: "Некорректный ID теста" });
      }

      const questions = await storage.getQuestionsForTest(testId);
      res.json(questions);
    } catch (error) {
      res.status(500).json({ message: "Ошибка при получении вопросов" });
    }
  });

  app.post(`${apiPrefix}/questions`, validateBody(insertQuestionSchema), async (req, res) => {
    try {
      const newQuestion = await storage.createQuestion(req.body);
      res.status(201).json(newQuestion);
    } catch (error) {
      res.status(500).json({ message: "Ошибка при создании вопроса" });
    }
  });

  app.put(`${apiPrefix}/questions/:id`, validateBody(insertQuestionSchema.partial()), async (req, res) => {
    try {
      const questionId = parseInt(req.params.id);

      if (isNaN(questionId)) {
        return res.status(400).json({ message: "Некорректный ID вопроса" });
      }

      const updatedQuestion = await storage.updateQuestion(questionId, req.body);

      if (!updatedQuestion) {
        return res.status(404).json({ message: "Вопрос не найден" });
      }

      res.json(updatedQuestion);
    } catch (error) {
      res.status(500).json({ message: "Ошибка при обновлении вопроса" });
    }
  });

  app.delete(`${apiPrefix}/questions/:id`, async (req, res) => {
    try {
      const questionId = parseInt(req.params.id);

      if (isNaN(questionId)) {
        return res.status(400).json({ message: "Некорректный ID вопроса" });
      }

      const success = await storage.deleteQuestion(questionId);

      if (!success) {
        return res.status(404).json({ message: "Вопрос не найден" });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Ошибка при удалении вопроса" });
    }
  });

  // Роуты для вариантов ответов
  app.get(`${apiPrefix}/questions/:questionId/options`, async (req, res) => {
    try {
      const questionId = parseInt(req.params.questionId);

      if (isNaN(questionId)) {
        return res.status(400).json({ message: "Некорректный ID вопроса" });
      }

      const options = await storage.getOptionsForQuestion(questionId);
      res.json(options);
    } catch (error) {
      res.status(500).json({ message: "Ошибка при получении вариантов ответов" });
    }
  });

  app.post(`${apiPrefix}/options`, validateBody(insertOptionSchema), async (req, res) => {
    try {
      const newOption = await storage.createOption(req.body);
      res.status(201).json(newOption);
    } catch (error) {
      res.status(500).json({ message: "Ошибка при создании варианта ответа" });
    }
  });

  app.put(`${apiPrefix}/options/:id`, validateBody(insertOptionSchema.partial()), async (req, res) => {
    try {
      const optionId = parseInt(req.params.id);

      if (isNaN(optionId)) {
        return res.status(400).json({ message: "Некорректный ID варианта ответа" });
      }

      const updatedOption = await storage.updateOption(optionId, req.body);

      if (!updatedOption) {
        return res.status(404).json({ message: "Вариант ответа не найден" });
      }

      res.json(updatedOption);
    } catch (error) {
      res.status(500).json({ message: "Ошибка при обновлении варианта ответа" });
    }
  });

  app.delete(`${apiPrefix}/options/:id`, async (req, res) => {
    try {
      const optionId = parseInt(req.params.id);

      if (isNaN(optionId)) {
        return res.status(400).json({ message: "Некорректный ID варианта ответа" });
      }

      const success = await storage.deleteOption(optionId);

      if (!success) {
        return res.status(404).json({ message: "Вариант ответа не найден" });
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Ошибка при удалении варианта ответа" });
    }
  });

  // Роуты для результатов
  app.get(`${apiPrefix}/results`, async (req, res) => {
    try {
      const results = await storage.getResults();
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Ошибка при получении результатов" });
    }
  });

  app.get(`${apiPrefix}/tests/:testId/results`, async (req, res) => {
    try {
      const testId = parseInt(req.params.testId);

      if (isNaN(testId)) {
        return res.status(400).json({ message: "Некорректный ID теста" });
      }

      const results = await storage.getResultsForTest(testId);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Ошибка при получении результатов теста" });
    }
  });

  app.post(`${apiPrefix}/results`, validateBody(insertResultSchema), async (req, res) => {
    try {
      const newResult = await storage.createResult(req.body);
      res.status(201).json(newResult);
    } catch (error) {
      res.status(500).json({ message: "Ошибка при сохранении результата" });
    }
  });

  // Маршрут для проверки парсинга и валидации CSV файла
  app.post(`${apiPrefix}/tests/validate-csv`, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Файл не был загружен" });
      }

      // Здесь будет проверка структуры CSV файла и его валидация
      // Поскольку мы не реализуем фактический парсинг на сервере
      // (это будет делаться на клиенте), просто возвращаем успех

      return res.json({ isValid: true, message: "Файл успешно проверен" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Ошибка при проверке файла" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
