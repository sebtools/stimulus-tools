/**
 * DataEventStore - RxDB Implementation
 * 
 * Provides universal data events using RxDB database.
 * Integrates RxDB with your existing event-driven architecture.
 * 
 * Features:
 * - Listens for data:* events and performs storage operations
 * - Emits data:* events in response to storage changes
 * - Live query subscriptions for automatic UI updates
 * - Multi-tab synchronization (changes in Tab A appear in Tab B automatically!)
 * 
 * Compatible with your existing event system - no changes needed to UI code!
 */

export default class RxDBDataEventStore {
  constructor(rxDatabase) {
    if (!rxDatabase) {
      throw new Error('RxDBDataEventStore requires an RxDB database instance');
    }
    
    this.db = rxDatabase;
    this.subscriptions = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    console.log('🚀 Initializing RxDB data event store...');
    
    // Setup data event listeners (same as Dexie version!)
    this.setupDataEventListeners();
    
    // Setup live queries (NEW: automatic reactivity!)
    this.setupLiveQueries();
    
    this.isInitialized = true;
    console.log('✓ RxDB data event store initialized');
  }

  /**
   * Setup listeners for universal data events
   * These are the same events your UI already uses!
   */
  setupDataEventListeners() {
    document.addEventListener('data:save', this.handleSave.bind(this));
    document.addEventListener('data:delete', this.handleDelete.bind(this));
    document.addEventListener('data:query', this.handleQuery.bind(this));
    document.addEventListener('data:load', this.handleLoad.bind(this));
    document.addEventListener('data:clear', this.handleClear.bind(this));
  }

  /**
   * Setup live query subscriptions
   * 
   * This is RxDB's killer feature! Automatic reactivity.
   * Whenever data changes (even from other tabs or remote sync),
   * your UI automatically gets updated via data:changed events.
   */
  setupLiveQueries() {
    console.log('📡 Setting up live queries for automatic UI updates...');
    
    // Subscribe to subcategories
    const subcategoriesSub = this.db.subcategories
      .find({
        selector: { deleted: false }
      })
      .$.subscribe(docs => {
        const records = docs.map(doc => doc.toJSON());
        
        document.dispatchEvent(new CustomEvent('data:changed', {
          detail: {
            table: 'subcategories',
            records,
            count: records.length,
            source: 'live-query'
          },
          bubbles: true
        }));
      });
    
    this.subscriptions.set('subcategories', subcategoriesSub);
    
    // Subscribe to time_entries
    const timeEntriesSub = this.db.time_entries
      .find({
        selector: { deleted: false }
      })
      .$.subscribe(docs => {
        const records = docs.map(doc => doc.toJSON());
        
        document.dispatchEvent(new CustomEvent('data:changed', {
          detail: {
            table: 'time_entries',
            records,
            count: records.length,
            source: 'live-query'
          },
          bubbles: true
        }));
      });
    
    this.subscriptions.set('time_entries', timeEntriesSub);
    
    // Subscribe to categories (less frequent changes)
    const categoriesSub = this.db.categories
      .find()
      .$.subscribe(docs => {
        const records = docs.map(doc => doc.toJSON());
        
        document.dispatchEvent(new CustomEvent('data:changed', {
          detail: {
            table: 'categories',
            records,
            count: records.length,
            source: 'live-query'
          },
          bubbles: true
        }));
      });
    
    this.subscriptions.set('categories', categoriesSub);
    
    console.log('✓ Live queries active for all collections');
  }

  /**
   * Handle data:save events
   * Saves or updates a record in RxDB
   */
  async handleSave(event) {
    const { table, record } = event.detail;
    
    try {
      // Fire before-save event (for validation, hooks, etc.)
      const beforeEvent = new CustomEvent('data:before-save', {
        detail: { 
          table, 
          record, 
          operation: record.id ? 'update' : 'create',
          target: 'rxdb'
        },
        bubbles: true,
        cancelable: true
      });
      
      const allowed = document.dispatchEvent(beforeEvent);
      if (!allowed) {
        console.log(`data:save cancelled for ${table}`);
        return;
      }
      
      // Get collection
      const collection = this.db[table];
      if (!collection) {
        throw new Error(`Collection '${table}' does not exist`);
      }
      
      // Determine if insert or update
      if (record.id) {
        // Try to find existing document
        const existingDoc = await collection.findOne(record.id).exec();
        
        if (existingDoc) {
          // Update existing document
          await existingDoc.patch(record);
          console.log(`✓ Updated ${table}:${record.id}`);
        } else {
          // Insert new document with existing ID
          await collection.insert(record);
          console.log(`✓ Inserted ${table}:${record.id}`);
        }
      } else {
        // Insert new document (ID will be generated by hook)
        const doc = await collection.insert(record);
        record.id = doc.id; // Update record with generated ID
        console.log(`✓ Inserted ${table}:${record.id}`);
      }
      
      // Fire data:saved event for immediate feedback
      // (Live query will also fire data:changed, but this is synchronous)
      document.dispatchEvent(new CustomEvent('data:saved', {
        detail: {
          table,
          record,
          operation: 'save'
        },
        bubbles: true
      }));
      
    } catch (error) {
      console.error(`Error saving to ${table}:`, error);
      
      document.dispatchEvent(new CustomEvent('data:error', {
        detail: {
          table,
          error: error.message,
          operation: 'save'
        },
        bubbles: true
      }));
    }
  }

  /**
   * Handle data:delete events
   * Performs soft delete (sets deleted = true)
   */
  async handleDelete(event) {
    const { table, id } = event.detail;
    
    try {
      const collection = this.db[table];
      if (!collection) {
        throw new Error(`Collection '${table}' does not exist`);
      }
      
      const doc = await collection.findOne(id).exec();
      
      if (doc) {
        // Soft delete
        await doc.patch({ deleted: true });
        
        console.log(`✓ Deleted ${table}:${id}`);
        
        document.dispatchEvent(new CustomEvent('data:deleted', {
          detail: { table, id },
          bubbles: true
        }));
      } else {
        console.warn(`Document not found for delete: ${table}:${id}`);
      }
      
    } catch (error) {
      console.error(`Error deleting from ${table}:`, error);
      
      document.dispatchEvent(new CustomEvent('data:error', {
        detail: {
          table,
          id,
          error: error.message,
          operation: 'delete'
        },
        bubbles: true
      }));
    }
  }

  /**
   * Handle data:query events
   * Queries records from RxDB
   */
  async handleQuery(event) {
    const { table, query = {}, callback } = event.detail;
    
    try {
      const collection = this.db[table];
      if (!collection) {
        throw new Error(`Collection '${table}' does not exist`);
      }
      
      // Build RxDB query
      let rxQuery = collection.find();
      
      // Apply selector (filter)
      if (query.selector) {
        rxQuery = collection.find({ selector: query.selector });
      }
      
      // Apply sort
      if (query.sort) {
        rxQuery = rxQuery.sort(query.sort);
      }
      
      // Apply limit
      if (query.limit) {
        rxQuery = rxQuery.limit(query.limit);
      }
      
      // Execute query
      const docs = await rxQuery.exec();
      const records = docs.map(doc => doc.toJSON());
      
      // Return via callback or event
      if (callback) {
        callback(records);
      } else {
        document.dispatchEvent(new CustomEvent('data:loaded', {
          detail: {
            table,
            records,
            query,
            count: records.length
          },
          bubbles: true
        }));
      }
      
    } catch (error) {
      console.error(`Error querying ${table}:`, error);
      
      document.dispatchEvent(new CustomEvent('data:error', {
        detail: {
          table,
          query,
          error: error.message,
          operation: 'query'
        },
        bubbles: true
      }));
    }
  }

  /**
   * Handle data:load events
   * Loads a single record by ID
   */
  async handleLoad(event) {
    const { table, id, callback } = event.detail;
    
    try {
      const collection = this.db[table];
      if (!collection) {
        throw new Error(`Collection '${table}' does not exist`);
      }
      
      const doc = await collection.findOne(id).exec();
      const record = doc ? doc.toJSON() : null;
      
      if (callback) {
        callback(record);
      } else {
        document.dispatchEvent(new CustomEvent('data:loaded', {
          detail: {
            table,
            record,
            id
          },
          bubbles: true
        }));
      }
      
    } catch (error) {
      console.error(`Error loading from ${table}:`, error);
      
      document.dispatchEvent(new CustomEvent('data:error', {
        detail: {
          table,
          id,
          error: error.message,
          operation: 'load'
        },
        bubbles: true
      }));
    }
  }

  /**
   * Handle data:clear events
   * Clears all records from a table (careful!)
   */
  async handleClear(event) {
    const { table } = event.detail;
    
    try {
      const collection = this.db[table];
      if (!collection) {
        throw new Error(`Collection '${table}' does not exist`);
      }
      
      // Get all documents and remove them
      const docs = await collection.find().exec();
      await collection.bulkRemove(docs.map(doc => doc.id));
      
      console.log(`✓ Cleared all records from ${table}`);
      
      document.dispatchEvent(new CustomEvent('data:cleared', {
        detail: { table },
        bubbles: true
      }));
      
    } catch (error) {
      console.error(`Error clearing ${table}:`, error);
      
      document.dispatchEvent(new CustomEvent('data:error', {
        detail: {
          table,
          error: error.message,
          operation: 'clear'
        },
        bubbles: true
      }));
    }
  }

  /**
   * Cleanup subscriptions
   * Call this when destroying the store
   */
  destroy() {
    console.log('Cleaning up RxDB data event store...');
    
    this.subscriptions.forEach((sub, key) => {
      sub.unsubscribe();
      console.log(`✓ Unsubscribed from ${key}`);
    });
    
    this.subscriptions.clear();
    this.isInitialized = false;
  }
}
