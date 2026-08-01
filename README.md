# TaskForge

A real-time, dependency-aware Kanban task scheduler for internal team coordination. Built for student association HR teams, TaskForge goes beyond a basic Trello clone with three core differentiators:

1. **Task Dependencies** — Tasks can depend on other tasks and stay locked until their prerequisites are completed
2. **Event Templates** — Reusable task blueprints that auto-generate a full dependency-linked task tree with computed deadlines
3. **Escalation Engine** — Overdue tasks automatically escalate up the reporting hierarchy with timed notifications

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React (Vite), Bootstrap CSS |
| Backend | Node.js + Express |
| Database | MongoDB (native driver, no Mongoose) |
| Auth | JWT + bcrypt |
| Real-time | Socket.io |
| Scheduling | node-cron |
| Drag & Drop | @hello-pangea/dnd |

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB running locally on port 27017 (or set `MONGODB_URI`)

### Setup

```bash
# Clone and install
git clone <repo-url> && cd TaskForge

# Server
cd server
npm install
cp .env.example .env   # or create .env manually (see below)
node src/seed.js        # seed demo data
npm run dev             # starts on :3001

# Client (new terminal)
cd client
npm install
npm run dev             # starts on :5173
```

### Environment Variables

Create `server/.env`:

```env
MONGODB_URI=mongodb://localhost:27017/taskforge
JWT_SECRET=your_secret_here
PORT=3001

# Escalation config (optional)
ESCALATION_CRON=*/30 * * * *    # default: every 30 min (use */1 * * * * for testing)
ESCALATION_HOURS=24              # hours before L1→L2 escalation (use 0 for instant testing)
```

### Demo Accounts

All seeded with password: `password123`

| Email | Role | Name |
|-------|------|------|
| head@demo.com | Head | Priya Sharma |
| jh@demo.com | Joint Head | Arjun Patel |
| member@demo.com | Member | Maya Nair |

**Invite code:** `DEMO2026`

## Architecture

### Dependency Engine

Located in `server/src/utils/dependencies.js`:

- **`computeStatus(task, allTasks)`** — Returns `"locked"` if any task in `task.dependsOn` has `status !== "done"`, otherwise returns the task's current non-locked status. This is the single source of truth for lock state, used by:
  - Task creation (initial status)
  - Task completion (recomputes dependents)
  - Template instantiation (initial state calculation)

- **`wouldCreateCycle(taskId, deps, allTasks)`** — DFS-based cycle detection before accepting dependency changes

- **`findDirectDependents(taskId, allTasks)`** — Finds all tasks that depend on a given task, used during completion to unlock them

### Template Instantiation

`POST /api/boards/from-template`:

1. Creates a board with the template name + event date
2. **First pass:** Creates all tasks with `dueDate = eventDate + offsetDaysFromEvent`
3. **Second pass:** Maps `blueprintId → real ObjectId` for `dependsOn` fields
4. Auto-assigns by matching blueprint `role` string to workspace member roles
5. Runs `computeStatus()` on every task to set initial locked/open states

Blueprint dependencies reference other blueprints within the same template (by `blueprintId`), not real task IDs — those are generated fresh each time.

### Escalation System

`server/src/jobs/escalation.js` runs on a `node-cron` schedule:

- **Level 0 → 1:** When `dueDate < now && status !== "done"`, notifies the assignee and sets `escalationLevel = 1`
- **Level 1 → 2:** After `ESCALATION_HOURS` hours past due date, notifies all `joint_head` and `head` users with the assignee's name
- **Duplicate prevention:** `existsForTaskLevel()` checks if a notification already exists for that task+level
- **Live push:** If the target user is connected via Socket.io, they get the notification instantly via the `userSocketMap`

### Real-Time Sync

Socket.io is purely a **broadcast layer** — REST stays the source of truth for every write:

- Board rooms: clients `join_board` with the board ID
- Events: `task_moved`, `task_updated`, `task_created`, `task_deleted`, `tasks_unlocked`
- Phase 6 additions: `comment_added`, `poll_created`, `poll_updated`, `notification`

### Data Model

```
users           { _id, name, email, passwordHash, workspaceId, role }
workspaces      { _id, name, ownerId, memberIds, inviteCode }
boards          { _id, workspaceId, name, eventDate, columns[] }
tasks           { _id, boardId, columnId, order, title, description,
                  assignedTo, dueDate, dependsOn[], status, escalationLevel }
eventTemplates  { _id, workspaceId, name, taskBlueprint[] }
notifications   { _id, userId, taskId, message, read, createdAt }
activityLogs    { _id, taskId, userId, action, detail, timestamp }
comments        { _id, taskId, userId, text, createdAt }
polls           { _id, boardId, question, options[{text, votes[]}], closesAt }
```

## Features by Phase

### Phase 1: Foundation
- JWT auth with role-based access (head / joint_head / member)
- Workspace creation + invite code join flow
- Board + task CRUD with column management

### Phase 2: Drag-and-Drop + Real-Time
- @hello-pangea/dnd for column-to-column drag
- Socket.io real-time sync across browser tabs

### Phase 3: Task Dependencies
- `dependsOn` field with cycle detection
- Locked task rendering (greyed out, non-draggable)
- Auto-unlock on dependency completion
- Dependency graph visualization (DAG)

### Phase 4: Event Templates
- Template editor with blueprint tasks, roles, offsets, and inter-blueprint dependencies
- One-click board instantiation with date-offset due dates
- Role-based auto-assignment

### Phase 5: Escalation Engine
- node-cron job with configurable interval
- L0→L1→L2 tiered escalation notifications
- In-app notification bell with live Socket.io push
- Mark-read, mark-all-read

### Phase 6: Polish
- **Activity Log**: Chronological feed on every task (created, moved, assigned, completed, commented)
- **Comments**: Real-time comments via Socket.io with chat-like UI
- **Polls**: Board-level voting with live count updates, auto-close
- **Workload Dashboard**: Open-task count per member with progress bars
- **Contribution Leaderboard**: Ranked by tasks completed, with completion rate %

## Project Structure

```
TaskForge/
├── client/
│   ├── src/
│   │   ├── api/index.js              # All API endpoints
│   │   ├── components/
│   │   │   ├── Board.jsx             # Main board view
│   │   │   ├── Column.jsx            # Droppable column
│   │   │   ├── TaskCard.jsx          # Draggable task card
│   │   │   ├── TaskForm.jsx          # Create/edit task modal
│   │   │   ├── TaskDetailDrawer.jsx  # Activity + comments drawer
│   │   │   ├── DependencyGraph.jsx   # DAG visualization
│   │   │   ├── NotificationBell.jsx  # Bell icon + dropdown
│   │   │   ├── PollsPanel.jsx        # Board polls
│   │   │   ├── TemplateEditor.jsx    # Blueprint editor
│   │   │   └── CreateFromTemplate.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── BoardContext.jsx
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── WorkspacePage.jsx
│   │   │   ├── BoardsPage.jsx
│   │   │   └── DashboardPage.jsx     # Workload + Leaderboard
│   │   └── socket.js
│   └── vite.config.js
└── server/
    ├── src/
    │   ├── db.js                     # MongoDB singleton
    │   ├── server.js                 # Express + Socket.io entry
    │   ├── seed.js                   # Demo data seeder
    │   ├── middleware/auth.js        # JWT + RBAC middleware
    │   ├── models/                   # MongoDB collection functions
    │   ├── routes/                   # Express routers
    │   ├── sockets/index.js          # Socket.io handlers + userId map
    │   ├── jobs/escalation.js        # node-cron escalation job
    │   └── utils/dependencies.js     # computeStatus, wouldCreateCycle
    └── .env
```

## License

MIT
