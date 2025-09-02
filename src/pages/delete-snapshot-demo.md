---
title: "Delete Snapshot Confirmation Demo"
description: "Demo page showing the UIKit-styled delete snapshot confirmation dialog"
layout: page
---

# Delete Snapshot Confirmation Demo

This page demonstrates the UIKit-styled delete snapshot confirmation dialog.

## Usage

To use the delete snapshot confirmation template, include it in your Nunjucks template:

```njk
{% include "delete-snapshot-confirmation.njk" %}
```

## Features

- **UIKit Styling**: Modern, clean design with proper spacing and typography
- **Warning Icon**: Prominent warning icon at the start of the message
- **Primary Button**: Delete button styled as a primary action with danger styling
- **Responsive Design**: Works well on mobile and desktop devices
- **Accessibility**: Proper ARIA labels and semantic HTML
- **Animation**: Smooth entrance animation for better UX

## Example

<button type="button" class="tdbc-button" onclick="showDeleteConfirmation()">
  Show Delete Confirmation
</button>

<div id="delete-confirmation-demo" class="delete-snapshot-confirmation" style="display: none;">
  <div class="delete-snapshot-confirmation__content">
    <div class="delete-snapshot-confirmation__header">
      <div class="delete-snapshot-confirmation__icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9ZM19 21H5V3H13V9H19V21Z" fill="currentColor"/>
          <path d="M12 8C13.1 8 14 8.9 14 10C14 11.1 13.1 12 12 12C10.9 12 10 11.1 10 10C10 8.9 10.9 8 12 8ZM12 14C14.21 14 16 15.79 16 18V20H8V18C8 15.79 9.79 14 12 14Z" fill="currentColor"/>
        </svg>
      </div>
      <h2 id="delete-snapshot-title" class="delete-snapshot-confirmation__title">
        Delete Snapshot
      </h2>
    </div>
    
    <div class="delete-snapshot-confirmation__body">
      <p id="delete-snapshot-message" class="delete-snapshot-confirmation__message">
        Are you sure you want to delete this snapshot? This action cannot be undone.
      </p>
    </div>
    
    <div class="delete-snapshot-confirmation__actions">
      <button type="button" class="tdbc-button tdbc-button-outlined delete-snapshot-confirmation__cancel" onclick="hideDeleteConfirmation()">
        Cancel
      </button>
      <button type="button" class="tdbc-button tdbc-button--danger delete-snapshot-confirmation__confirm" onclick="confirmDelete()">
        Delete Snapshot
      </button>
    </div>
  </div>
</div>

<script>
function showDeleteConfirmation() {
  document.getElementById('delete-confirmation-demo').style.display = 'flex';
}

function hideDeleteConfirmation() {
  document.getElementById('delete-confirmation-demo').style.display = 'none';
}

function confirmDelete() {
  alert('Snapshot deleted! (This is just a demo)');
  hideDeleteConfirmation();
}

// Close modal when clicking outside
document.getElementById('delete-confirmation-demo').addEventListener('click', function(e) {
  if (e.target === this) {
    hideDeleteConfirmation();
  }
});
</script>