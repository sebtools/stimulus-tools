# Data Events System

A universal data layer that enables multiple UI frameworks to share the same storage backend through a clean event-driven architecture.

## Architecture Overview

```
UI Layer:     [Record System] [React Components] [Vue Components]
                    ↓                 ↓                 ↓  
Bridge Layer: [...DataEventBridge implementations...]
                    ↓                 ↓                 ↓  
Event Layer:        ← Universal data:* events →
                                     ↓
Storage Layer:        [DataEventStore + Storage Backend]
```

## Core Components

### DataEventStore (Storage Abstraction)

- **`data-event-store-memory.js`** - In-memory storage for development/testing
- **`data-event-store-dexie.js`** - IndexedDB via Dexie wrapper  
- **`data-event-store-supabase.js`** - Supabase cloud database

### DataEventBridge (UI Translation)

- **`data-event-bridge-record.js`** - For the existing record system
- **`data-event-bridge-react.js`** - For React components
- **`data-event-bridge-vue.js`** - For Vue components

### Universal Events

All DataEventStores emit and listen for these events:

**Input Events:**
- `data:save` - Save/update a record
- `data:delete` - Delete a record  
- `data:query` - Query for records
- `data:load` - Load single record by ID

**Output Events:**
- `data:saved` - Record was saved
- `data:changed` - Record was updated
- `data:deleted` - Record was deleted
- `data:queried` - Query results available
- `data:loaded` - Single record loaded
- `data:error` - Operation failed

## Key Features

### 1. Storage Backend Flexibility

Switch storage systems without changing UI code:

```javascript
// Development: Use memory
const store = new DataEventStoreMemory();

// Production: Use IndexedDB  
const store = new DataEventStoreIndexedDB(dexieInstance);

// Cloud: Use Supabase
const store = new DataEventStoreSupabase(supabaseClient);
```

### 2. Schema Mapping

Translate between logical UI names and physical storage names:

```javascript
const bridge = new DataEventBridgeReact({
  tableMapping: {
    tasks: 'user_tasks'  // React uses 'tasks', DB has 'user_tasks'
  },
  fieldMapping: {
    tasks: {
      title: 'task_title',      // UI: title → DB: task_title
      completed: 'is_completed'  // UI: completed → DB: is_completed
    }
  }
});
```

### 3. Multi-UI Support

Multiple UI frameworks can share the same data:

```javascript
// One storage backend
const store = new DataEventStoreIndexedDB(database);

// Multiple UI bridges
const recordBridge = new DataEventBridgeRecord();
const reactBridge = new DataEventBridgeReact(); 
const vueBridge = new DataEventBridgeVue();

// All UIs stay synchronized automatically!
```

## Usage Examples

### Basic Setup

```javascript
import DataEventStoreMemory from './data-events/data-event-store-memory.js';
import DataEventBridgeRecord from './data-events/data-event-bridge-record.js';

// Create storage
const store = new DataEventStoreMemory();

// Create UI bridge  
const bridge = new DataEventBridgeRecord();

// Save from record system
document.dispatchEvent(new CustomEvent('record:ui:save', {
  detail: { 
    table: 'tasks', 
    record: { title: 'Hello World' }
  }
}));
```

### With Schema Mapping

```javascript
const bridge = new DataEventBridgeReact({
  tableMapping: { tasks: 'project_tasks' },
  fieldMapping: { 
    tasks: { 
      title: 'task_name',
      completed: 'is_finished' 
    }
  }
});

// React component saves with logical names
document.dispatchEvent(new CustomEvent('react:item:save', {
  detail: {
    collection: 'tasks',  // → 'project_tasks' in storage
    item: { 
      title: 'Learn React',     // → 'task_name' in storage
      completed: false          // → 'is_finished' in storage  
    }
  }
}));
```

## Event Conventions

### Record System Events
- **UI → Data:** `record:ui:*` → `data:*`
- **Data → UI:** `data:*` → `record:data:*`

### React Component Events  
- **UI → Data:** `react:item:*` / `react:collection:*` → `data:*`
- **Data → UI:** `data:*` → `react:item:*` / `react:collection:*`

### Vue Component Events
- **UI → Data:** `vue:resource:*` → `data:*` 
- **Data → UI:** `data:*` → `vue:resource:*`

## File Organization

```
js/data-events/
├── data-event-store-memory.js      # Memory storage
├── data-event-store-dexie.js       # IndexedDB storage  
├── data-event-store-supabase.js    # Supabase storage
├── data-event-bridge-record.js     # Record system bridge
├── data-event-bridge-react.js      # React bridge
├── data-event-bridge-vue.js        # Vue bridge
├── usage-examples.js               # Usage patterns
└── README.md                       # This file
```

## Benefits

1. **Separation of Concerns** - UI logic separate from storage logic
2. **Storage Flexibility** - Easy to switch backends  
3. **Schema Agnostic** - UI and storage can use different names
4. **Multi-UI Support** - Multiple frameworks can share data
5. **Real-time Sync** - All UIs automatically stay synchronized
6. **Testing Friendly** - Use memory storage for tests

## Adding New UI Frameworks

To add support for a new UI framework:

1. Create `data-event-bridge-[framework].js`
2. Define framework-specific event conventions  
3. Implement translation to/from universal `data:*` events
4. Include the same mapping capabilities
5. Follow the consistent naming pattern

The universal DataEventStore layer will work with any bridge implementation.