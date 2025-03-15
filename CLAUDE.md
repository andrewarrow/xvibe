# XVIBE Development Guide

## Commands
- Client dev: `cd client && npm run dev`
- Server dev: `cd server && npm run dev`
- Full stack: `npm run dev` (runs both client and server)
- Install all: `npm run install:all`
- Lint: `cd client && npm run lint`
- Build: `cd client && npm run build`

## Code Style
- **JavaScript Only**: Never use TypeScript features or type annotations
- **Components**: Function components with React hooks, no class components
- **Naming**: PascalCase for components, camelCase for variables/functions
- **Imports**: Group imports (React, libraries, local components, styles)
- **Error Handling**: Use try/catch with specific error types
- **State Management**: Context API for global state, useState for local state
- **CSS**: Tailwind for styling with className approach
- **JSDoc**: Use comments for documenting functions when needed

## Project Structure
- Client: React (JS) frontend with Vite and Tailwind
- Server: Node.js/Express backend with JWT auth
- Database: SQLite with better-sqlite3