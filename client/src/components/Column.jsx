import { Droppable, Draggable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';
import { Plus } from 'lucide-react';

// Map column names → accent colours from CSS design tokens
const COLUMN_COLORS = {
  'To Do':       'var(--col-todo)',
  'In Progress': 'var(--col-inprogress)',
  'Blocked':     'var(--col-blocked)',
  'Done':        'var(--col-done)',
};

const COLUMN_GRADIENTS = {
  'To Do':       'linear-gradient(135deg,rgba(87,157,255,0.15),rgba(87,157,255,0.04))',
  'In Progress': 'linear-gradient(135deg,rgba(96,198,210,0.15),rgba(96,198,210,0.04))',
  'Blocked':     'linear-gradient(135deg,rgba(245,205,71,0.15),rgba(245,205,71,0.04))',
  'Done':        'linear-gradient(135deg,rgba(75,206,151,0.15),rgba(75,206,151,0.04))',
};

export default function Column({
  column, tasks, members, allTasks = [],
  onAddTask, onEditTask, onDeleteTask, onCompleteTask, canEdit, onTaskClick,
}) {
  const accent = COLUMN_COLORS[column.name] || 'var(--col-todo)';
  const gradient = COLUMN_GRADIENTS[column.name] || COLUMN_GRADIENTS['To Do'];
  const droppableId = column._id.toString();

  return (
    <div className="tf-column">
      {/* ── Column header ── */}
      <div className="tf-column-header">
        <div
          className="tf-column-dot"
          style={{ background: accent, boxShadow: `0 0 6px ${accent}` }}
        />
        <span className="tf-column-name">{column.name}</span>
        <span className="tf-column-count">{tasks.length}</span>
        {canEdit && (
          <button
            className="tf-icon-btn"
            onClick={onAddTask}
            title="Add a card"
            style={{ marginLeft: 2 }}
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* ── Droppable body ── */}
      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`tf-column-body ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
            style={{
              background: snapshot.isDraggingOver ? gradient : 'transparent',
              minHeight: 60,
            }}
          >
            {tasks.map((task, index) => (
              <Draggable
                key={task._id.toString()}
                draggableId={task._id.toString()}
                index={index}
                isDragDisabled={task.status === 'locked'}
              >
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                    style={dragProvided.draggableProps.style}
                  >
                    <TaskCard
                      task={task}
                      members={members}
                      allTasks={allTasks}
                      onEdit={onEditTask}
                      onDelete={onDeleteTask}
                      onComplete={onCompleteTask}
                      canEdit={canEdit}
                      isDragging={dragSnapshot.isDragging}
                      onTaskClick={onTaskClick}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}

            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--tf-text-muted)',
                  textAlign: 'center',
                  marginTop: 16,
                  opacity: 0.6,
                  userSelect: 'none',
                }}
              >
                No cards
              </p>
            )}
          </div>
        )}
      </Droppable>

      {/* ── Add card button at bottom ── */}
      {canEdit && (
        <button className="tf-add-card-btn" onClick={onAddTask}>
          <Plus size={14} /> Add a card
        </button>
      )}
    </div>
  );
}
