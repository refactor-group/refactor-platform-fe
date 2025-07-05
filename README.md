# Refactor Coaching & Mentoring Platform

## Frontend (currently web browser-only)

![377960688-0b5292b0-6ec7-4774-984e-8e99e503d26c](https://github.com/user-attachments/assets/5dcdee09-802e-4b25-aa58-757d607ce7bc)
A preview of the main coaching session page (rapidly evolving)

## Intro

A web frontend built on Next.js that provides a web API for various client applications (e.g. a web frontend) that facilitate the coaching and mentoring of software engineers.

The platform itself is useful for professional independent coaches, informal mentors and engineering leaders who work with individual software engineers and/or teams by providing a single application that facilitates and enhances your coaching practice.

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

### Setting Local Environment Variables

When running locally on a development machine you can manually set the application's configuration through a `.env` file at the root of the source tree:

```env
NEXT_PUBLIC_BACKEND_SERVICE_PROTOCOL="http"
NEXT_PUBLIC_BACKEND_SERVICE_PORT=4000
NEXT_PUBLIC_BACKEND_SERVICE_HOST="localhost"
NEXT_PUBLIC_BACKEND_API_VERSION="1.0.0-beta1"

# TIPTAP_APP_ID originates from your TipTap Cloud Dashboard
NEXT_PUBLIC_TIPTAP_APP_ID="<TIPTAP_APP_ID>"

FRONTEND_SERVICE_INTERFACE=0.0.0.0
FRONTEND_SERVICE_PORT=3000
```

**Note** that these variables get set and passed by docker-compose in the backend's `.env` file and _do not_ need to be set here in this case.

### Running the Development Server

```bash
npm run dev
```

### Logging Into the Application

Open [http://localhost:3000](http://localhost:3000) with your browser to log in to the platform.

## Testing

This project includes a comprehensive testing suite with unit tests, integration tests, and end-to-end tests to ensure reliable state management and user interactions.

### Prerequisites

Ensure all dependencies are installed:

```bash
npm install
```

### Available Test Commands

#### Unit & Integration Tests
```bash
# Run all unit and integration tests
npm run test

# Run tests with interactive UI (great for development)
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

#### End-to-End Tests
```bash
# Run E2E tests (requires dev server to be running)
npm run test:e2e

# Run E2E tests with interactive UI
npm run test:e2e:ui

# Run all tests (unit + integration + E2E)
npm run test:all
```

### Running Tests Step-by-Step

#### 1. Unit & Integration Tests (Fastest)
These test individual components, hooks, and state stores in isolation:

```bash
npm run test
```

**What this covers:**
- State store logic (organization, coaching relationship, auth)
- React hooks behavior 
- Component rendering and interactions
- API mocking with realistic responses

#### 2. End-to-End Tests (Most Comprehensive)
These test complete user workflows in a real browser:

```bash
# First, start the development server in one terminal
npm run dev

# Then in another terminal, run E2E tests
npm run test:e2e
```

**What this covers:**
- State persistence across page navigation
- Logout clearing all stored state
- Error handling (403 forbidden pages)
- Session relationship ID syncing
- Cross-browser compatibility

### Test Structure

- **`__tests__/`** - Unit and integration tests
  - `stores/` - State management logic tests
  - `hooks/` - React hooks integration tests  
  - `components/` - UI component tests
- **`e2e/`** - End-to-end browser tests
- **`src/test-utils/`** - Testing utilities and mocks

### Debugging Tests

If tests fail, you can:

1. **Run tests in UI mode** for better debugging:
   ```bash
   npm run test:ui          # For unit tests
   npm run test:e2e:ui      # For E2E tests
   ```

2. **Run specific test files**:
   ```bash
   npm run test -- __tests__/stores/auth-store.test.ts
   ```

3. **Check test coverage**:
   ```bash
   npm run test:coverage
   ```

### Continuous Integration

All tests should pass before merging code. The test suite is designed to:
- Catch state management regressions
- Prevent logout/session bugs
- Validate user interaction flows
- Ensure cross-browser compatibility

For more detailed testing information, see [docs/testing/frontend-testing-strategy.md](./docs/testing/frontend-testing-strategy.md).

#### For Working with and Running the Application in Docker, navigate to the [Container-README](./docs/runbooks/Container-README.md)
