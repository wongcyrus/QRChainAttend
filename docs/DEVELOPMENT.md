# Development Guide

## Getting Started

### Prerequisites

- Node.js 18+ (specified in `.nvmrc`)
- npm or yarn
- Azure Functions Core Tools v4
- Azure CLI (for deployment)

### Initial Setup

```bash
# Install dependencies
npm install

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install

# Install shared dependencies
cd ../shared && npm install
```

### Local Development

#### Backend (Azure Functions)

```bash
cd backend

# Copy environment template
cp .env.example local.settings.json

# Update local.settings.json with your values

# Start Functions runtime
npm start
```

Functions will be available at `http://localhost:7071/api/`

#### Frontend (Next.js)

```bash
cd frontend

# Start development server
npm run dev
```

Application will be available at `http://localhost:3000`

### Environment Configuration

#### Backend (`backend/local.settings.json`)

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "SignalRConnectionString": "<your-signalr-connection>",
    "AZURE_OPENAI_ENDPOINT": "<your-openai-endpoint>",
    "AZURE_OPENAI_API_KEY": "<your-openai-key>"
  }
}
```

#### Frontend (`.env.local`)

```bash
NEXT_PUBLIC_API_URL=http://localhost:7071/api
```

## Project Structure

```
.
├── backend/              # Azure Functions backend
│   ├── src/
│   │   ├── functions/   # HTTP and timer triggered functions
│   │   ├── services/    # Business logic services
│   │   ├── middleware/  # Error handling middleware
│   │   ├── storage/     # Storage abstractions
│   │   ├── utils/       # Utility functions
│   │   └── types/       # TypeScript type definitions
│   └── host.json        # Functions host configuration
├── frontend/            # Next.js frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── pages/       # Next.js pages
│   │   └── utils/       # Utility functions
│   └── public/          # Static assets and PWA files
├── shared/              # Shared types and utilities
│   └── src/types/       # Shared TypeScript types
├── infrastructure/      # Bicep infrastructure templates
│   ├── modules/         # Bicep modules
│   └── parameters/      # Environment parameters
└── docs/                # Documentation
```

## Testing

### Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- AuthService.test.ts
```

### Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Test Structure

- Unit tests: `*.test.ts` or `*.test.tsx`
- Property-based tests: `*.property.test.ts`
- Cache tests: `*.cache.test.ts`
- Integration tests: `*.integration.test.ts`

## Code Quality

### Linting

```bash
# Backend
cd backend && npm run lint

# Frontend
cd frontend && npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

### Type Checking

```bash
# Backend
cd backend && npm run type-check

# Frontend
cd frontend && npm run type-check
```

### Pre-commit Hooks

Consider setting up Husky for pre-commit hooks:

```bash
npm install --save-dev husky lint-staged
npx husky install
```

## Debugging

### Backend (VS Code)

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Attach to Node Functions",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "preLaunchTask": "func: host start"
    }
  ]
}
```

### Frontend (VS Code)

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev"
    }
  ]
}
```

## Common Development Tasks

### Adding a New API Endpoint

1. Create function in `backend/src/functions/`
2. Add types to `shared/src/types/`
3. Implement service logic in `backend/src/services/`
4. Add tests
5. Update API documentation

### Adding a New Component

1. Create component in `frontend/src/components/`
2. Add component tests
3. Create README.md with usage examples
4. Export from appropriate index file

### Updating Shared Types

1. Modify types in `shared/src/types/`
2. Rebuild shared package: `cd shared && npm run build`
3. Update backend and frontend imports
4. Run tests to verify compatibility

## Performance Optimization

### Backend
- Use caching for frequently accessed data
- Implement connection pooling for storage
- Optimize table queries with proper partitioning
- Use async/await properly to avoid blocking

### Frontend
- Lazy load components with `next/dynamic`
- Optimize images with `next/image`
- Implement code splitting
- Use React.memo for expensive components
- Minimize bundle size

## Troubleshooting

### Backend Issues

**Functions not starting:**
- Check `local.settings.json` configuration
- Verify Azure Functions Core Tools version
- Check port 7071 is not in use

**Storage connection errors:**
- Use Azurite for local storage emulation
- Verify connection strings

### Frontend Issues

**Build errors:**
- Clear `.next` directory: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`

**API connection issues:**
- Verify backend is running
- Check CORS configuration
- Verify API URL in environment variables

## Best Practices

### Code Style
- Use TypeScript strict mode
- Follow ESLint rules
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Keep functions small and focused

### Git Workflow
- Create feature branches from `main`
- Write descriptive commit messages
- Keep commits atomic and focused
- Squash commits before merging
- Update documentation with code changes

### Testing
- Write tests before fixing bugs
- Aim for >80% code coverage
- Test edge cases and error conditions
- Use property-based testing for complex logic
- Mock external dependencies

### Security
- Never commit secrets or API keys
- Use environment variables for configuration
- Validate all user inputs
- Sanitize data before storage
- Follow OWASP guidelines

## Resources

- [Azure Functions Documentation](https://docs.microsoft.com/azure/azure-functions/)
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/react)
