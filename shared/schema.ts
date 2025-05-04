import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Модель теста
export const tests = pgTable("tests", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  questionCount: integer("question_count").notNull().default(0),
  allowRepeatQuestions: boolean("allow_repeat_questions").notNull().default(false),
  timeLimit: integer("time_limit").notNull().default(0), // в минутах, 0 - без ограничения
  maxCorrectAnswers: integer("max_correct_answers").notNull().default(0), // 0 - без ограничения
  maxWrongAnswers: integer("max_wrong_answers").notNull().default(0)  // 0 - без ограничения
});

// Модель вопроса
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  testId: integer("test_id").notNull(),
  text: text("text").notNull(),
  position: integer("position").notNull()
});

// Модель варианта ответа
export const options = pgTable("options", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").notNull(),
  text: text("text").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false)
});

// Модель результата прохождения теста
export const results = pgTable("results", {
  id: serial("id").primaryKey(),
  testId: integer("test_id").notNull(),
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  answers: json("answers").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  timeTaken: integer("time_taken").default(0), // время прохождения в секундах
  isCompleted: boolean("is_completed").notNull().default(true), // завершен ли тест или прерван
  isPaused: boolean("is_paused").notNull().default(false) // находится ли тест на паузе
});

// Схемы для валидации и типы

export const insertTestSchema = createInsertSchema(tests).pick({
  title: true,
  description: true,
  allowRepeatQuestions: true,
  timeLimit: true,
  maxCorrectAnswers: true,
  maxWrongAnswers: true
});

export const insertQuestionSchema = createInsertSchema(questions).pick({
  testId: true,
  text: true,
  position: true
});

export const insertOptionSchema = createInsertSchema(options).pick({
  questionId: true,
  text: true,
  isCorrect: true
});

export const insertResultSchema = createInsertSchema(results).pick({
  testId: true,
  score: true,
  totalQuestions: true,
  answers: true,
  timeTaken: true,
  isCompleted: true,
  isPaused: true
});

// Типы для вставки
export type InsertTest = z.infer<typeof insertTestSchema>;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type InsertOption = z.infer<typeof insertOptionSchema>;
export type InsertResult = z.infer<typeof insertResultSchema>;

// Типы для выборки
export type Test = typeof tests.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Option = typeof options.$inferSelect;
export type Result = typeof results.$inferSelect;

// Расширенные типы для бизнес-логики
export type TestWithQuestions = Test & {
  questions: (Question & {
    options: Option[]
  })[]
};

export type CSVQuestion = {
  question_id: string;
  question: string;
  variants: string;
};

export type CSVAnswer = {
  question_id: string;
  answers: string;
};

// Валидаторы для импорта CSV
export const csvQuestionSchema = z.object({
  question_id: z.string().min(1, "ID вопроса обязателен"),
  question: z.string().min(3, "Текст вопроса должен содержать минимум 3 символа"),
  variants: z.string().min(1, "Должен быть хотя бы один вариант ответа")
});

export const csvAnswerSchema = z.object({
  question_id: z.string().min(1, "ID вопроса обязателен"),
  answers: z.string().min(1, "Должен быть хотя бы один правильный ответ")
});

export type CsvValidationResult = {
  isValid: boolean;
  questions?: CSVQuestion[];
  answers?: CSVAnswer[];
  error?: string;
};

// Пользовательский тип для теста, который проходится
export type TestSession = {
  testId: number;
  currentQuestionIndex: number;
  answers: Record<number, number[]>; // questionId -> selectedOptionIds[]
  totalQuestions: number;
  startTime?: Date; // время начала теста
  pausedTime?: number; // общее время на паузе в мс
  lastPauseTime?: Date; // время последней паузы
  isPaused?: boolean; // находится ли тест на паузе
  correctAnswers?: number; // количество правильных ответов
  wrongAnswers?: number; // количество неправильных ответов
};

export type TestStatistics = {
  testId: number;
  totalAttempts: number; // всего попыток
  successfulAttempts: number; // успешных попыток (>= 60%)
  averageScore: number; // средний балл
  bestScore: number; // лучший результат
  worstScore: number; // худший результат
  averageTime: number; // среднее время прохождения в секундах
  questionStats: Record<number, {
    questionId: number;
    correctCount: number; // сколько раз ответили правильно
    incorrectCount: number; // сколько раз ответили неправильно
    totalCount: number; // сколько раз встречался вопрос
  }>;
};
