import { Droppable, Draggable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';
import { Plus } from 'lucide-react';

const COLUMN_DOT_COLORS = {
  'To Do':       'var(--col-todo)',
  'In Progress': 'var(--col-inprogress)',
  'Blocked':     'var(--col-blocked)',
  'Done':        'var(--col-done)',
};

export default function Column({
  column, tasks, members, allTasks = [],
  onAddTask, onEditTask, onDeleteTask, onCompleteTask, canEdit, onTaskClick,
}) {
  const accent = COLUMN_DOT_COLORS[column.name] || 'var(--tf-ink)';
  const droppableId = column._id.toString();

  return (
    <div className="tf-column">
      {/* ── Column Header ── */}
      <div className="tf-column-header">
        <div
          className="tf-column-dot"
          style={{ background: accent }}
        />
        <span className="tf-column-name">{column.name}</span>
        <span className="tf-column-count">{tasks.length}</span>
        {canEdit && (
          <button
            className="tf-icon-btn"
            onClick={onAddTask}
            title="Create issue in column"
            style={{ marginLeft: 'auto' }}
          >
            <Plus size={13} />
          </button>
        )}
      </div>

      {/* ── Droppable Body ── */}
      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`tf-column-body ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
            style={{
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
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--tf-text-faint)',
                  textAlign: 'center',
                  padding: '24px 0',
                  userSelect: 'none',
                }}
              >
                No active issues
              </div>
            )}
          </div>
        )}
      </Droppable>

      {/* ── Add Issue Button ── */}
      {canEdit && (
        <button className="tf-add-card-btn" onClick={onAddTask}>
          <Plus size={13} /> Add issue
        </button>
      )}
    </div>
  );
}
