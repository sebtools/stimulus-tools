/**
 * Data Events System - Usage Example
 * 
 * This demonstrates how the complete data events system works with
 * multiple UI frameworks sharing a single DataEventStore.
 * 
 * Architecture:
 * 
 * UI Layer:    [Record System] [React Component] [Vue Component]
 *                    ↓                ↓                ↓  
 * Bridge Layer: [DataEventBridge...Record/React/Vue...]
 *                    ↓                ↓                ↓  
 * Event Layer:       ← Universal data:* events →
 *                                    ↓
 * Storage Layer:        [DataEventStore + Storage]
 */

// Example 1: Memory storage with Record system
import DataEventStoreMemory from './data-event-store-memory.js';
import DataEventBridgeRecord from './data-event-bridge-record.js';

const memoryStore = new DataEventStoreMemory();
const recordBridge = new DataEventBridgeRecord();

// Now the record system can work with memory storage
document.dispatchEvent(new CustomEvent('record:ui:save', {
  detail: {
    table: 'tasks',
    record: { title: 'Learn data events', completed: false }
  }
}));

// Example 2: IndexedDB with React components 
import DataEventStoreIndexedDB from './data-event-store-dexie.js';
import DataEventBridgeReact from './data-event-bridge-react.js';

// Assuming you have a Dexie database instance
const dexieDB = new Dexie('MyApp');
dexieDB.version(1).stores({
  user_tasks: '++id, task_title, is_completed, user_id'
});

const indexedDBStore = new DataEventStoreIndexedDB(dexieDB);
const reactBridge = new DataEventBridgeReact({
  tableMapping: {
    tasks: 'user_tasks'  // React says 'tasks', DB has 'user_tasks'
  },
  fieldMapping: {
    tasks: {
      title: 'task_title',      // React: title → DB: task_title
      completed: 'is_completed', // React: completed → DB: is_completed
      userId: 'user_id'          // React: userId → DB: user_id
    }
  }
});

// React component can now work with IndexedDB
document.dispatchEvent(new CustomEvent('react:item:save', {
  detail: {
    collection: 'tasks',
    item: { title: 'Learn React', completed: false, userId: 123 }
  }
}));

// Example 3: Supabase with Vue components
import DataEventStoreSupabase from './data-event-store-supabase.js';
import DataEventBridgeVue from './data-event-bridge-vue.js';

// Assuming you have a Supabase client
const supabase = createClient('your-url', 'your-key');

const supabaseStore = new DataEventStoreSupabase(supabase);
const vueBridge = new DataEventBridgeVue({
  tableMapping: {
    tasks: 'project_tasks'  // Vue says 'tasks', Supabase has 'project_tasks'
  },
  fieldMapping: {
    tasks: {
      title: 'task_name',    // Vue: title → Supabase: task_name
      completed: 'is_done'   // Vue: completed → Supabase: is_done
    }
  }
});

// Vue component can now work with Supabase
document.dispatchEvent(new CustomEvent('vue:resource:save', {
  detail: {
    resource: 'tasks',
    data: { title: 'Learn Vue', completed: false }
  }
}));

// Example 4: Multiple UI systems with same storage
// You can have React, Vue, AND Record system all working with IndexedDB:

const sharedDB = new Dexie('SharedApp');
sharedDB.version(1).stores({
  tasks: '++id, title, completed'
});

const sharedStore = new DataEventStoreIndexedDB(sharedDB);

// Each UI gets its own bridge
const recordBridgeShared = new DataEventBridgeRecord();
const reactBridgeShared = new DataEventBridgeReact();
const vueBridgeShared = new DataEventBridgeVue();

// Now ALL three UI systems can read/write the same data!
// When React saves a task, Vue and Record system get notified
// When Record system deletes a task, React and Vue get notified

// Example 5: Switching storage backends
// To switch from IndexedDB to Supabase, you only change the DataEventStore:

// Old:
// const store = new DataEventStoreIndexedDB(dexieDB);

// New:
// const store = new DataEventStoreSupabase(supabaseClient);

// All bridges and UI components continue working unchanged!

console.log('Data Events Usage Examples loaded');

export { 
  // You can export individual pieces for targeted usage
  DataEventStoreMemory,
  DataEventStoreIndexedDB, 
  DataEventStoreSupabase,
  DataEventBridgeRecord,
  DataEventBridgeReact,
  DataEventBridgeVue
};