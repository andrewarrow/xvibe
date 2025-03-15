# XVibe

A simple web application with a React frontend and Node.js backend using SQLite database.

## Features

- User authentication (login/register)
- Secure password storage with bcrypt
- JWT-based authentication
- Responsive UI with Tailwind CSS
- TypeScript for type safety

## Technology Stack

- **Frontend**: React, JavaScript, Tailwind CSS, Vite
- **Backend**: Node.js, Express, JavaScript
- **Database**: SQLite with better-sqlite3
- **Authentication**: JWT, bcrypt

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Clone the repository
   ```
   git clone <repository-url>
   cd xvibe
   ```

2. Install dependencies
   ```
   npm run install:all
   ```

3. Start the development servers
   ```
   npm run dev
   ```

This will start both the client and server in development mode.
- Client runs at: http://localhost:5173
- Server runs at: http://localhost:5000

## Default Test User

A test user is automatically created in the database:
- **Username**: andrewarrow
- **Password**: testing

## Project Structure

```
xvibe/
├── client/              # Frontend React application
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── contexts/    # React contexts
│   │   ├── hooks/       # Custom React hooks
│   │   └── pages/       # Page components
├── server/              # Backend Node.js application
│   ├── src/
│   │   ├── routes/      # API routes
│   │   ├── middleware/  # Express middleware
│   │   └── db.ts        # Database setup and operations
└── db/                  # SQLite database files
```

## API Endpoints

- **POST /api/auth/register**: Register a new user
- **POST /api/auth/login**: Login a user