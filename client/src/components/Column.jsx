import TaskCard from './TaskCard';
import { Button, Dropdown } from 'react-bootstrap';
import { Plus, ArrowRight } from 'lucide-react';

const columnColors = {
  'To Do': '#6366f1',
  'In Progress': '#06b6d4',
  'Blocked': '#f59e0b',
  'Done': '#10b981',
};

export default function Column({ column, tasks, members, allColumns, onAddTask, onEditTask, onDeleteTask, onMoveTask, canEdit }) {
  const accentColor = columnColors[column.name] || '#6366f1';

  return (
    <div
      className="d-flex flex-column rounded-3 p-0"
      style={{
        minWidth: 280,
        maxWidth: 320,
        flex: '1 1 280px',
        backgroundColor: 'rgba(30,30,46,0.7)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Column header */}
      <div
        className="d-flex justify-content-between align-items-center px-3 py-2 rounded-top-3"
        style={{ borderBottom: `2px solid ${accentColor}` }}
      >
        <div className="d-flex align-items-center gap-2">
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: accentColor }} />
          <span className="fw-semibold text-light" style={{ fontSize: '0.85rem' }}>{column.name}</span>
          <span
            className="badge rounded-pill"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#aaa', fontSize: '0.7rem' }}
          >
            {tasks.length}
          </span>
        </div>
        {canEdit && (
          <Button
            variant="link"
            size="sm"
            className="p-0 text-secondary"
            onClick={onAddTask}
            title="Add task"
          >
            <Plus size={16} />
          </Button>
        )}
      </div>

      {/* Tasks */}
      <div className="p-2 flex-grow-1" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
        {tasks.map((task) => (
          <div key={task._id.toString()}>
            <TaskCard
              task={task}
              members={members}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              canEdit={canEdit}
            />
            {/* Move dropdown */}
            {canEdit && (
              <div className="d-flex justify-content-end mb-2" style={{ marginTop: -6 }}>
                <Dropdown>
                  <Dropdown.Toggle
                    variant="link"
                    size="sm"
                    className="p-0 text-secondary"
                    style={{ fontSize: '0.7rem', textDecoration: 'none' }}
                  >
                    <ArrowRight size={11} className="me-1" />Move
                  </Dropdown.Toggle>
                  <Dropdown.Menu className="bg-dark border-secondary">
                    {allColumns
                      .filter((c) => c._id.toString() !== column._id.toString())
                      .map((c) => (
                        <Dropdown.Item
                          key={c._id.toString()}
                          onClick={() => onMoveTask(task._id, c._id.toString())}
                          className="text-light small"
                          style={{ fontSize: '0.8rem' }}
                        >
                          {c.name}
                        </Dropdown.Item>
                      ))}
                  </Dropdown.Menu>
                </Dropdown>
              </div>
            )}
          </div>
        ))}
        {tasks.length === 0 && (
          <p className="text-secondary text-center small mt-3" style={{ opacity: 0.5 }}>
            No tasks
          </p>
        )}
      </div>
    </div>
  );
}
