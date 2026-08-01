# TaskForge

A real-time, dependency-aware Kanban task scheduler for student org HR teams. Built as a full-stack MERN application.

## Features (Phase 1)

- **User Auth**: JWT-based registration & login with bcrypt password hashing
- **Workspaces**: Create workspaces, generate invite codes, join via code
- **Role-Based Access**: `head`, `joint_head`, and `member` roles with middleware-enforced permissions
- **Boards**: CRUD with 4 default columns (To Do, In Progress, Blocked, Done)
- **Tasks**: Create, edit, delete, move between columns, with assignee and due date

## Tech Stack

- **Frontend**: React (Vite) + Bootstrap CSS
- **Backend**: Node.js + Express
- **Database**: MongoDB (native driver, no Mongoose)
- **Auth**: JWT + bcrypt

## Setup

### Prerequisites

- Node.js 18+
- MongoDB running locally (or MongoDB Atlas URI)

### Environment Variables

Copy the example env file and adjust as needed:

```bash
cd server
cp .env.example .env
```

Required variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `MONGODB_URI` | `mongodb://localhost:27017/taskforge` | MongoDB connection string |
| `JWT_SECRET` | — | Secret key for JWT signing |
| `PORT` | `3001` | Backend server port |

### Install & Run

```bash
# Install server dependencies
cd server
npm install

# Seed demo data (optional)
npm run seed

# Start the server
npm run dev

# In a new terminal, install & start the client
cd client
npm install
npm run dev
```

The client runs on `http://localhost:5173` and proxies API calls to `http://localhost:3001`.

### Demo Accounts

After running `npm run seed`, these accounts are available (password: `password123`):

| Email | Role | Name |
|-------|------|------|
| `head@demo.com` | Head | Priya Sharma |
| `jh@demo.com` | Joint Head | Arjun Patel |
| `member@demo.com` | Member | Maya Nair |

Workspace invite code: `DEMO2026`

## Project Structure

```
/server
  /src
    /routes         auth.js, workspaces.js, boards.js, tasks.js
    /models         users.js, workspaces.js, boards.js, tasks.js
    /middleware      auth.js (JWT + role check)
    db.js           Single MongoDB connection helper
    server.js       Express entry point
    seed.js         Demo data seeder

/client
  /src
    /api            REST client (axios)
    /components     Board, Column, TaskCard, TaskForm
    /context        AuthContext
    /pages          LoginPage, RegisterPage, WorkspacePage, BoardsPage
    App.jsx         Routes & auth guards
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Register new user |
| POST | `/api/auth/login` | — | Login, get JWT |
| POST | `/api/workspaces` | ✓ | Create workspace |
| GET | `/api/workspaces/:id` | ✓ | Get workspace + members |
| POST | `/api/workspaces/:id/invite` | ✓ head/jh | Regenerate invite code |
| POST | `/api/workspaces/join/:code` | ✓ | Join workspace |
| GET | `/api/boards?workspaceId=` | ✓ | List boards |
| POST | `/api/boards` | ✓ head/jh | Create board |
| PATCH | `/api/boards/:id/columns` | ✓ head/jh | Update columns |
| DELETE | `/api/boards/:id` | ✓ head/jh | Delete board |
| GET | `/api/tasks?boardId=` | ✓ | List tasks |
| POST | `/api/tasks` | ✓ | Create task |
| PATCH | `/api/tasks/:id` | ✓ | Update task |
| DELETE | `/api/tasks/:id` | ✓ head/jh | Delete task |
