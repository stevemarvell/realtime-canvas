// Jest setup file
// Global test configuration and setup

// Increase timeout for tests that need it
jest.setTimeout(10000);

// Mock console methods if needed to reduce noise
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  // Optionally suppress specific console messages during tests
  // console.error = jest.fn();
  // console.warn = jest.fn();
});

afterAll(() => {
  // Restore console
  console.error = originalError;
  console.warn = originalWarn;
});

// Global test setup
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

// Mock window.matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
