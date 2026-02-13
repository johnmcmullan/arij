// Tract - Board Drag & Drop (Vanilla JS, no frameworks)

let draggedTicket = null;

// Make all ticket cards draggable
document.querySelectorAll('.ticket-card').forEach(card => {
  card.addEventListener('dragstart', handleDragStart);
  card.addEventListener('dragend', handleDragEnd);
});

// Make all columns droppable
document.querySelectorAll('.tickets-container').forEach(container => {
  container.addEventListener('dragover', handleDragOver);
  container.addEventListener('drop', handleDrop);
  container.addEventListener('dragleave', handleDragLeave);
});

function handleDragStart(e) {
  draggedTicket = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragEnd(e) {
  this.classList.remove('dragging');
  
  // Remove all drag-over highlights
  document.querySelectorAll('.tickets-container').forEach(container => {
    container.classList.remove('drag-over');
  });
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault(); // Allows drop
  }
  
  this.classList.add('drag-over');
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDragLeave(e) {
  this.classList.remove('drag-over');
}

function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation(); // Stops browser redirect
  }
  
  e.preventDefault();
  
  const newColumn = this.parentElement;
  const newStatus = newColumn.dataset.status;
  const ticketId = draggedTicket.dataset.ticketId;
  
  // Move the ticket in the DOM
  this.appendChild(draggedTicket);
  
  // Update the ticket count in headers
  updateColumnCounts();
  
  // Send PATCH request to update status in database
  updateTicketStatus(ticketId, newStatus);
  
  this.classList.remove('drag-over');
  
  return false;
}

function updateColumnCounts() {
  document.querySelectorAll('.board-column').forEach(column => {
    const status = column.dataset.status;
    const count = column.querySelectorAll('.ticket-card').length;
    const header = column.querySelector('h3');
    const statusText = status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1);
    header.textContent = `${statusText} (${count})`;
  });
}

function updateTicketStatus(ticketId, newStatus) {
  fetch(`/tickets/${ticketId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: newStatus })
  })
  .then(response => response.json())
  .then(data => {
    if (!data.success) {
      console.error('Failed to update ticket status');
      // Could show an error message to user here
    }
  })
  .catch(error => {
    console.error('Error:', error);
    // Could show an error message to user here
  });
}

// Add visual feedback styles
const style = document.createElement('style');
style.textContent = `
  .drag-over {
    background: #e8f4fd !important;
    border: 2px dashed #3498db;
  }
`;
document.head.appendChild(style);
