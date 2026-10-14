# AI-Powered Evangadi Forum

An AI-enhanced question-and-answer forum built as a full-stack learning project for my Evangadi Tech bootcamp certification and developer portfolio.

**Author:** Ashenafi Elias  
**Project type:** Full-stack web application with AI-assisted features  
**Status:** In development / deployment preparation

> This is a portfolio and educational project. Update the links below with your actual GitHub repository and deployed website URLs after publishing.

## Overview

The AI-Powered Evangadi Forum combines a discussion forum with AI-assisted tools intended to help users discover related questions and work with answers and learning documents.

### Main capabilities

- User registration and login using JWT-based authentication.
- Questions and answers for community knowledge sharing.
- Role-aware administration and moderation features.
- AI-powered semantic search for finding related questions.
- AI-assisted answer-fit / answer ranking and draft-coaching features.
- PDF-based retrieval-augmented generation (RAG) workflow for supported user documents.
- MySQL persistence for application data.

Availability of individual features depends on the current implementation and configuration. AI features require a valid Gemini API key and may be affected by API quotas.

## Technology stack

**Frontend**

- React
- Vite
- React Router
- TanStack Query
- Axios

**Backend**

- Node.js
- Express
- MySQL (`mysql2`)
- JWT authentication
- `bcryptjs` for password hashing
- Gemini API through `@google/genai`
- PDF parsing and retrieval-related services

**Planned deployment architecture**

- Frontend: Vercel
- Backend/API: Render
- Database: Aiven MySQL Free tier

## Repository structure

```text
ai-powered-forum/
├── frontend/          # React + Vite client
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── .env.example
├── backend/            # Express API
│   ├── db/             # Database configuration, schema and migrations
│   ├── src/            # API routes, controllers, services and AI logic
│   ├── scripts/
│   ├── package.json
│   └── .env.example
└── README.md
```

## Prerequisites

Install the following before running the project locally:

- Node.js (use a current LTS release compatible with the installed dependencies)
- npm
- MySQL locally, or access to an Aiven MySQL database
- A Gemini API key for AI-powered features
- Git (for version control)

## Local setup

### 1. Clone the repository

Replace the example URL with the actual URL of your GitHub repository.

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY
```

### 2. Configure the backend

```bash
cd backend
npm ci
```

Copy the example environment file and fill in your own values:

```bash
cp .env.example .env
```

Configure at least the following backend variables in `backend/.env`:

```env
PORT=3999
DB_HOST=your_mysql_host
DB_PORT=your_mysql_port
DB_USER=your_mysql_username
DB_PASS=your_mysql_password
DB_NAME=your_database_name
DB_SSL=true
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=1d
GEMINI_API_KEY=your_gemini_api_key
```

Use the actual database connection values supplied by your MySQL provider. For Aiven, configure TLS/SSL and its CA certificate according to the database configuration implemented in `backend/db/config.js`. Do not commit `.env` files or real credentials to GitHub.

### 3. Initialize the database

Review `backend/db/schema.sql` before running it. The schema contains destructive `DROP TABLE IF EXISTS` statements, so only use it to initialize a new, empty database. Do not rerun it against a database containing data.

Apply any applicable migrations using the project's migration command:

```bash
npm run db:migrate
```

Run this from the `backend` directory. Check each migration and your current schema before applying changes to a database that already contains data.

### 4. Start the backend

From the `backend` directory:

```bash
npm start
```

For development with automatic restarts:

```bash
npm run dev
```

### 5. Configure and start the frontend

Open a second terminal at the repository root:

```bash
cd frontend
npm ci
```

Copy the example frontend environment file:

```bash
cp .env.example .env
```

Set `VITE_API_BASE_URL` to the local backend URL used by your backend configuration. The example file currently uses:

```env
VITE_API_BASE_URL=http://localhost:3777
```

If your backend is listening on a different port, update this value to match. Then start the Vite development server:

```bash
npm run dev
```

Open the local URL printed by Vite in your terminal.

## Production deployment

### Frontend — Vercel

1. Import the GitHub repository into Vercel.
2. Set the project Root Directory to `frontend`.
3. Set the build command to `npm run build` and output directory to `dist`.
4. Add `VITE_API_BASE_URL` with the actual deployed Render backend base URL. Follow the frontend API client's URL convention; do not add an extra `/api` if request paths already include it.
5. Deploy and test page refreshes on nested routes.

### Backend — Render

1. Create a Web Service connected to the GitHub repository.
2. Set the Root Directory to `backend`.
3. Set the build command to `npm install` (or `npm ci` if supported by the deployment setup) and start command to `npm start`.
4. Add production environment variables in Render's dashboard. Do not upload `.env` files.
5. Set `FRONTEND_URL` to the exact deployed Vercel origin so the API's CORS configuration allows the frontend.
6. Configure the Aiven MySQL host, port, database, username, password and SSL/CA settings.
7. Add the Gemini API key and a strong, unique JWT secret.
8. Review Render logs and verify the health endpoint implemented by the backend.

### Database — Aiven MySQL

1. Create the MySQL service and database.
2. Copy the connection values from Aiven.
3. Configure SSL/TLS and the required CA certificate.
4. Initialize the schema once on a new, empty database, then apply reviewed migrations.
5. Verify the backend can connect to the database before testing the website.

### PDF storage note

The current RAG configuration uses a local upload directory by default (`uploads/rag`). Files stored on an ephemeral hosting filesystem may be lost when the service restarts or redeploys. Use persistent disk or object storage if uploaded PDFs must remain available in production, and verify that database records and source files stay in sync.

## Useful commands

Run commands from the relevant directory.

**Frontend (`frontend/`):**

```bash
npm run dev
npm run build
npm run lint
npm test
```

**Backend (`backend/`):**

```bash
npm start
npm run dev
npm test
npm run db:migrate
```

## Security notes

- Never commit `.env`, API keys, database passwords, JWT secrets, certificates, or private user data.
- Use a unique, high-entropy `JWT_SECRET` in production.
- Restrict CORS to trusted frontend origins.
- Use SSL/TLS for remote database connections.
- Review SQL migrations before applying them to a database with important data.
- Do not publish logs containing credentials, tokens, personal data, or stack traces with sensitive information.

## Project purpose

I am building this project as part of my Evangadi Tech bootcamp certification journey and to demonstrate my full-stack development and AI integration skills in my developer portfolio. The project helps me practice frontend/backend integration, database design, authentication, API development, and AI-assisted search and document workflows.

## Links

- **GitHub repository:** Add your repository URL here.
- **Live application:** Add your Vercel URL here after deployment.
- **Backend API:** Add your Render URL here after deployment.

## Acknowledgments

Thanks to Evangadi Tech and the learning community for the guidance and opportunity to build and improve this project.
