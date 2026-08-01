import { Droppable, Draggable } from '@hello-pangea/dnd';
import TaskCard from './TaskCard';
import { Button } from 'react-bootstrap';
import { Plus } from 'lucide-react';

const columnColors = {
  'To Do': '#6366f1',
  'In Progress': '#06b6d4',
  'Blocked': '#f59e0b',
  'Done': '#10b981',
};

export default function Column({ column, tasks, members, onAddTask, onEditTask, onDeleteTask, canEdit }) {
  const accentColor = columnColors[column.name] || '#6366f1';
  const droppableId = column._id.toString();

  return (
    <div
      className="d-flex flex-column rounded-3 p-0"
      style={{
        minWidth: 280,
        maxWidth: 320,
        flex: '1 1 280px',
        backgroundColor: 'rgba(30,30,46,0.7)',
        border: '1px solid rgba(255,255,255,0.08)',
        maxHeight: 'calc(100vh - 80px)',
        overflow: 'hidden',
      }}
    >
      {/* Column header */}
      <div
        className="d-flex justify-content-between align-items-center px-3 py-2"
        style={{ borderBottom: `2px solid ${accentColor}`, flexShrink: 0 }}
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

      {/* Droppable task area — no overflow on this div to avoid nested scroll warning */}
      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="p-2 flex-grow-1"
            style={{
              minHeight: 80,
              overflowY: 'auto',
              transition: 'background-color 0.2s ease',
              backgroundColor: snapshot.isDraggingOver
                ? 'rgba(99, 102, 241, 0.08)'
                : 'transparent',
            }}
          >
            {tasks.map((task, index) => (
              <Draggable
                key={task._id.toString()}
                draggableId={task._id.toString()}
                index={index}
              >
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                    style={{
                      ...dragProvided.draggableProps.style,
                      opacity: dragSnapshot.isDragging ? 0.85 : 1,
                    }}
                  >
                    <TaskCard
                      task={task}
                      members={members}
                      onEdit={onEditTask}
                      onDelete={onDeleteTask}
                      canEdit={canEdit}
                      isDragging={dragSnapshot.isDragging}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <p className="text-secondary text-center small mt-3" style={{ opacity: 0.5 }}>
                No tasks
              </p>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
