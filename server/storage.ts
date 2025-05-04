import { 
  tests, type Test, type InsertTest,
  questions, type Question, type InsertQuestion,
  options, type Option, type InsertOption,
  results, type Result, type InsertResult,
  type TestWithQuestions
} from "@shared/schema";

// интерфейс для хранилища
export interface IStorage {
  // Управление тестами
  getTests(): Promise<Test[]>;
  getTest(id: number): Promise<Test | undefined>;
  createTest(test: InsertTest): Promise<Test>;
  updateTest(id: number, test: Partial<InsertTest>): Promise<Test | undefined>;
  deleteTest(id: number): Promise<boolean>;
  
  // Управление вопросами и ответами
  getQuestionsForTest(testId: number): Promise<Question[]>;
  getQuestionWithOptions(questionId: number): Promise<Question & { options: Option[] } | undefined>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  updateQuestion(id: number, question: Partial<InsertQuestion>): Promise<Question | undefined>;
  deleteQuestion(id: number): Promise<boolean>;
  
  // Управление вариантами ответов
  getOptionsForQuestion(questionId: number): Promise<Option[]>;
  createOption(option: InsertOption): Promise<Option>;
  updateOption(id: number, option: Partial<InsertOption>): Promise<Option | undefined>;
  deleteOption(id: number): Promise<boolean>;
  
  // Результаты тестирования
  getResults(): Promise<Result[]>;
  getResultsForTest(testId: number): Promise<Result[]>;
  createResult(result: InsertResult): Promise<Result>;
  
  // Составные запросы
  getFullTest(testId: number): Promise<TestWithQuestions | undefined>;
  createFullTest(
    test: InsertTest, 
    questionsWithOptions: Array<{
      question: Omit<InsertQuestion, 'testId'>,
      options: Omit<InsertOption, 'questionId'>[]
    }>
  ): Promise<TestWithQuestions>;
}

export class MemStorage implements IStorage {
  private testMap: Map<number, Test>;
  private questionMap: Map<number, Question>;
  private optionMap: Map<number, Option>;
  private resultMap: Map<number, Result>;
  
  private testIdCounter: number;
  private questionIdCounter: number;
  private optionIdCounter: number;
  private resultIdCounter: number;
  
  constructor() {
    this.testMap = new Map();
    this.questionMap = new Map();
    this.optionMap = new Map();
    this.resultMap = new Map();
    
    this.testIdCounter = 1;
    this.questionIdCounter = 1;
    this.optionIdCounter = 1;
    this.resultIdCounter = 1;
    
    // Добавляем пример теста
    this.initializeDefaultTest();
  }
  
  // Инициализация примера теста
  private async initializeDefaultTest() {
    const testData: InsertTest = {
      title: "Основы нозологии",
      description: "Тест на знание основных понятий о болезнях и их классификации"
    };
    
    const test = await this.createTest(testData);
    
    // Добавим два вопроса с ответами
    const question1Data: InsertQuestion = {
      testId: test.id,
      text: "Нозология – это",
      position: 0
    };
    
    const question1 = await this.createQuestion(question1Data);
    
    // Варианты ответов для первого вопроса
    const options1 = [
      { text: "учение о причинах возникновения болезни", isCorrect: false },
      { text: "учение об условиях возникновения болезни", isCorrect: false },
      { text: "общее учение о болезни", isCorrect: true },
      { text: "учение о механизмах возникновения, развития и исходах болезни", isCorrect: false },
      { text: "учение о механизмах выздоровления", isCorrect: false }
    ];
    
    for (const opt of options1) {
      await this.createOption({
        questionId: question1.id,
        ...opt
      });
    }
    
    const question2Data: InsertQuestion = {
      testId: test.id,
      text: "Болезнь - это",
      position: 1
    };
    
    const question2 = await this.createQuestion(question2Data);
    
    // Варианты ответов для второго вопроса
    const options2 = [
      { text: "необычная реакция организма на какое-либо воздействие", isCorrect: false },
      { text: "сочетание явлений повреждения и защитно-приспособительных реакций", isCorrect: false },
      { text: "качественно новое состояние организма", isCorrect: false },
      { text: "ограничение приспособительных возможностей", isCorrect: true }
    ];
    
    for (const opt of options2) {
      await this.createOption({
        questionId: question2.id,
        ...opt
      });
    }
    
    // Обновим количество вопросов
    await this.updateTest(test.id, {
      ...testData,
      questionCount: 2
    });
  }
  
  async getTests(): Promise<Test[]> {
    return Array.from(this.testMap.values()).sort((a, b) => a.id - b.id);
  }
  
  async getTest(id: number): Promise<Test | undefined> {
    return this.testMap.get(id);
  }
  
  async createTest(test: InsertTest): Promise<Test> {
    const id = this.testIdCounter++;
    const createdAt = new Date();
    const updatedAt = createdAt;
    const questionCount = 0;
    
    const newTest: Test = { id, ...test, createdAt, updatedAt, questionCount };
    this.testMap.set(id, newTest);
    
    return newTest;
  }
  
  async updateTest(id: number, test: Partial<InsertTest>): Promise<Test | undefined> {
    const existingTest = this.testMap.get(id);
    
    if (!existingTest) {
      return undefined;
    }
    
    const updatedTest: Test = {
      ...existingTest,
      ...test,
      updatedAt: new Date()
    };
    
    this.testMap.set(id, updatedTest);
    return updatedTest;
  }
  
  async deleteTest(id: number): Promise<boolean> {
    if (!this.testMap.has(id)) {
      return false;
    }
    
    // Удаляем связанные вопросы и варианты ответов
    const questionsToDelete = Array.from(this.questionMap.values())
      .filter(q => q.testId === id);
    
    for (const question of questionsToDelete) {
      await this.deleteQuestion(question.id);
    }
    
    // Удаляем связанные результаты
    const resultsToDelete = Array.from(this.resultMap.values())
      .filter(r => r.testId === id);
    
    for (const result of resultsToDelete) {
      this.resultMap.delete(result.id);
    }
    
    return this.testMap.delete(id);
  }
  
  async getQuestionsForTest(testId: number): Promise<Question[]> {
    return Array.from(this.questionMap.values())
      .filter(q => q.testId === testId)
      .sort((a, b) => a.position - b.position);
  }
  
  async getQuestionWithOptions(questionId: number): Promise<Question & { options: Option[] } | undefined> {
    const question = this.questionMap.get(questionId);
    
    if (!question) {
      return undefined;
    }
    
    const options = await this.getOptionsForQuestion(questionId);
    
    return {
      ...question,
      options
    };
  }
  
  async createQuestion(question: InsertQuestion): Promise<Question> {
    const id = this.questionIdCounter++;
    
    const newQuestion: Question = { id, ...question };
    this.questionMap.set(id, newQuestion);
    
    // Обновляем количество вопросов в тесте
    const test = await this.getTest(question.testId);
    if (test) {
      await this.updateTest(test.id, {
        questionCount: test.questionCount + 1
      });
    }
    
    return newQuestion;
  }
  
  async updateQuestion(id: number, question: Partial<InsertQuestion>): Promise<Question | undefined> {
    const existingQuestion = this.questionMap.get(id);
    
    if (!existingQuestion) {
      return undefined;
    }
    
    const updatedQuestion: Question = {
      ...existingQuestion,
      ...question
    };
    
    this.questionMap.set(id, updatedQuestion);
    return updatedQuestion;
  }
  
  async deleteQuestion(id: number): Promise<boolean> {
    const question = this.questionMap.get(id);
    if (!question) {
      return false;
    }
    
    // Удаляем связанные варианты ответов
    const optionsToDelete = Array.from(this.optionMap.values())
      .filter(o => o.questionId === id);
    
    for (const option of optionsToDelete) {
      this.optionMap.delete(option.id);
    }
    
    // Обновляем количество вопросов в тесте
    const test = await this.getTest(question.testId);
    if (test) {
      await this.updateTest(test.id, {
        questionCount: Math.max(0, test.questionCount - 1)
      });
    }
    
    return this.questionMap.delete(id);
  }
  
  async getOptionsForQuestion(questionId: number): Promise<Option[]> {
    return Array.from(this.optionMap.values())
      .filter(o => o.questionId === questionId);
  }
  
  async createOption(option: InsertOption): Promise<Option> {
    const id = this.optionIdCounter++;
    
    const newOption: Option = { id, ...option };
    this.optionMap.set(id, newOption);
    
    return newOption;
  }
  
  async updateOption(id: number, option: Partial<InsertOption>): Promise<Option | undefined> {
    const existingOption = this.optionMap.get(id);
    
    if (!existingOption) {
      return undefined;
    }
    
    const updatedOption: Option = {
      ...existingOption,
      ...option
    };
    
    this.optionMap.set(id, updatedOption);
    return updatedOption;
  }
  
  async deleteOption(id: number): Promise<boolean> {
    return this.optionMap.delete(id);
  }
  
  async getResults(): Promise<Result[]> {
    return Array.from(this.resultMap.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }
  
  async getResultsForTest(testId: number): Promise<Result[]> {
    return Array.from(this.resultMap.values())
      .filter(r => r.testId === testId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }
  
  async createResult(result: InsertResult): Promise<Result> {
    const id = this.resultIdCounter++;
    const createdAt = new Date();
    
    const newResult: Result = { id, ...result, createdAt };
    this.resultMap.set(id, newResult);
    
    return newResult;
  }
  
  async getFullTest(testId: number): Promise<TestWithQuestions | undefined> {
    const test = await this.getTest(testId);
    
    if (!test) {
      return undefined;
    }
    
    const testQuestions = await this.getQuestionsForTest(testId);
    const questionsWithOptions = await Promise.all(
      testQuestions.map(async question => {
        const options = await this.getOptionsForQuestion(question.id);
        return {
          ...question,
          options
        };
      })
    );
    
    return {
      ...test,
      questions: questionsWithOptions
    };
  }
  
  async createFullTest(
    test: InsertTest, 
    questionsWithOptions: Array<{
      question: Omit<InsertQuestion, 'testId'>,
      options: Omit<InsertOption, 'questionId'>[]
    }>
  ): Promise<TestWithQuestions> {
    // Создаем тест
    const newTest = await this.createTest(test);
    
    // Создаем вопросы и опции
    const createdQuestions = await Promise.all(
      questionsWithOptions.map(async (item, index) => {
        const question = await this.createQuestion({
          testId: newTest.id,
          position: index,
          ...item.question
        });
        
        const options = await Promise.all(
          item.options.map(option => 
            this.createOption({
              questionId: question.id,
              ...option
            })
          )
        );
        
        return {
          ...question,
          options
        };
      })
    );
    
    // Обновляем количество вопросов
    await this.updateTest(newTest.id, {
      questionCount: createdQuestions.length
    });
    
    return {
      ...newTest,
      questionCount: createdQuestions.length,
      questions: createdQuestions
    };
  }
}

export const storage = new MemStorage();
