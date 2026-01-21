/**
 * DataEventStore - Dexie Implementation
 * 
 * Provides universal data events using an existing Dexie database instance.
 * Listens for data:* events and emits data:* events in response to storage changes.
 */

export default class DexieDataEventStore {
  constructor(dexieDatabase) {
    if (!dexieDatabase) {
      throw new Error('DexieDataEventStore requires a Dexie database instance');
    }
    
    this.db = dexieDatabase;
    this.isInitialized = false;
    
    // Validate database instance
    if (typeof this.db.open !== 'function') {
      throw new Error('Invalid Dexie database instance provided');
    }
  }

  // Helper method to validate database state
  async validateDatabase() {
    if (!this.db) {
      throw new Error('Database instance is null');
    }

    // Ensure the database is open
    if (!this.db.isOpen()) {
      await this.db.open();
    }
    
    if (!this.db.isOpen()) {
      throw new Error('Database is not open');
    }
    
    const tables = Object.keys(this.db._dbSchema || {});
    if (tables.length === 0) {
      throw new Error('No tables defined in database schema');
    }
    
    return tables;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    // Validate database state
    const tables = await this.validateDatabase();
    console.log(`Database validation successful. Available tables: ${tables.join(', ')}`);
      
    // Set up data event listeners (these are safe)
    this.setupDataEventListeners();
      
    this.isInitialized = true;
    console.log(`DexieDataEventStore initialized with database: ${this.db.name}`);
  }

  setupDataEventListeners() {
    // Listen for universal data events
    document.addEventListener('data:save', this.handleSave.bind(this));
    document.addEventListener('data:delete', this.handleDelete.bind(this));
    document.addEventListener('data:query', this.handleQuery.bind(this));
    document.addEventListener('data:load', this.handleLoad.bind(this));
    document.addEventListener('data:clear', this.handleClear.bind(this));
  }

  // Dispatch create event
  async dispatchCreateEvent(tableName, id) {
	// Convert id to number if it looks numeric
	const id_fixed = typeof id === 'string' && /^\d+$/.test(id) ? parseInt(id, 10) : id;

    //try {
      const record = await this.db[tableName].get(id_fixed);

	  console.log(record);
      if (record) {
        document.dispatchEvent(new CustomEvent('data:saved', {
          detail: {
            table: tableName,
            record,
            operation: 'create'
          },
          bubbles: true
        }));
      }
    //} catch (error) {
    //  console.warn(`Failed to dispatch create event for ${tableName}:${id}:`, error.message);
    //}
  }

  // Dispatch update event
  async dispatchUpdateEvent(tableName, id) {
    try {
      const record = await this.db[tableName].get(id);
      if (record) {
        document.dispatchEvent(new CustomEvent('data:changed', {
          detail: {
            table: tableName,
            id,
            record,
            operation: 'update'
          },
          bubbles: true
        }));
      }
    } catch (error) {
      console.warn(`Failed to dispatch update event for ${tableName}:${id}:`, error.message);
    }
  }

  // Dispatch delete event
  async dispatchDeleteEvent(tableName, id) {
    try {
      // For deletes, we don't have the record data from storagemutated
      // We'll dispatch with minimal info
      document.dispatchEvent(new CustomEvent('data:deleted', {
        detail: {
          table: tableName,
          id,
          record: null, // Record no longer exists
          operation: 'delete'
        },
        bubbles: true
      }));
    } catch (error) {
      console.warn(`Failed to dispatch delete event for ${tableName}:${id}:`, error.message);
    }
  }

  async handleSave(event) {
    
      const { table, record } = event.detail;
      
      // Check if table exists in the database schema
      if (!this.db[table]) {
        const availableTables = Object.keys(this.db._dbSchema);
        throw new Error(`Table '${table}' does not exist. Available tables: ${availableTables.join(', ')}`);
      }

      // Ensure database is open
      if (!this.db.isOpen()) {
        await this.db.open();
      }

      // Determine operation type
      const hasId = record.id !== undefined && record.id !== null && record.id !== '';
      const operation = hasId ? 'update' : 'create';

      // 🎯 NEW: Fire before-save event to allow record modification
      const beforeSaveEvent = new CustomEvent('data:before-save', {
        detail: {
          table,
          record,  // Pass by reference - listeners can modify
          operation,
          target: 'dexie'
        },
        cancelable: true,
        bubbles: true
      });
      
      const shouldContinue = document.dispatchEvent(beforeSaveEvent);
      if (!shouldContinue) {
        // Save was cancelled by a listener
        console.log('Save cancelled by data:before-save listener');
        return;
      }
      
      // Use the potentially modified record from the event
      const recordToSave = beforeSaveEvent.detail.record;

      // Handle numeric ID conversion for SERIAL keys (backwards compatibility)
      // Only convert if it's a numeric string (e.g., "123"), keep UUIDs as-is
      let recordId = recordToSave.id;
      if (typeof recordId === 'string' && /^\d+$/.test(recordId)) {
        recordId = parseInt(recordId, 10);
      }

      let savedRecord;

      if (recordId && await this.db[table].get(recordId)) {
        // ========== UPDATE ==========
        
        // Remove id from update data (Dexie handles it separately)
        const { id, ...dataWithoutId } = recordToSave;
        await this.db[table].update(recordId, dataWithoutId);
        
        savedRecord = await this.db[table].get(recordId);
        
        document.dispatchEvent(new CustomEvent('data:changed', {
          detail: {
            table,
            id: recordId,
            record: savedRecord,
            operation: 'update'
          },
          bubbles: true
        }));
        
      } else {
        // ========== CREATE ==========
        
        // Use put() if ID exists (for UUIDs), add() if not (for auto-increment)
        if (recordToSave.id) {
          await this.db[table].put(recordToSave);
          savedRecord = await this.db[table].get(recordToSave.id);
        } else {
          const id = await this.db[table].add(recordToSave);
          savedRecord = await this.db[table].get(id);
        }
        
        document.dispatchEvent(new CustomEvent('data:saved', {
          detail: {
            table,
            record: savedRecord,
            operation: 'create'
          },
          bubbles: true
        }));
      }

	}

  async handleDelete(event) {
    try {
      const { table, id } = event.detail;
      
      // Convert string ID to number for Dexie auto-increment primary key
      const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
      
      // Check if table exists in the database schema
      if (!this.db[table]) {
        const availableTables = Object.keys(this.db._dbSchema);
        throw new Error(`Table '${table}' does not exist. Available tables: ${availableTables.join(', ')}`);
      }

      // Ensure database is open
      if (!this.db.isOpen()) {
        await this.db.open();
      }

      const recordExists = await this.db[table].get(numericId);
      if (!recordExists) {
        throw new Error(`Record with id ${numericId} not found in table ${table}`);
      }

      await this.db[table].delete(numericId);
      
      document.dispatchEvent(new CustomEvent('data:deleted', {
        detail: {
          table,
          id: numericId,
          record: recordExists,
          operation: 'delete'
        },
        bubbles: true
      }));
    } catch (error) {
      console.error('Error in data:delete:', error);
      document.dispatchEvent(new CustomEvent('data:error', {
        detail: {
          operation: 'delete',
          table: event.detail.table,
          id: event.detail.id,
          error: {
            message: error.message,
            code: error.name || 'DELETE_ERROR'
          }
        },
        bubbles: true
      }));
    }
  }

  async handleQuery(event) {
    try {
      const { table, filter = {}, requestId } = event.detail;
      
      if (!this.db[table]) {
        throw new Error(`Table '${table}' does not exist`);
      }

      let collection = this.db[table];
      
      // Apply filters
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          collection = collection.where(key).equals(value);
        }
      });
      
      const results = await collection.toArray();
      
      document.dispatchEvent(new CustomEvent('data:queried', {
        detail: {
          table,
          results,
          filter,
          requestId,
          count: results.length
        },
        bubbles: true
      }));
    } catch (error) {
      console.error('Error in data:query:', error);
      document.dispatchEvent(new CustomEvent('data:error', {
        detail: {
          operation: 'query',
          table: event.detail.table,
          filter: event.detail.filter,
          error: {
            message: error.message,
            code: error.name || 'QUERY_ERROR'
          }
        },
        bubbles: true
      }));
    }
  }

  async handleLoad(event) {
    try {
      const { table, id, requestId } = event.detail;
      
      // Convert string ID to number for Dexie auto-increment primary key
      const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
      
      if (!this.db[table]) {
        throw new Error(`Table '${table}' does not exist`);
      }

      const record = await this.db[table].get(numericId);
      
      document.dispatchEvent(new CustomEvent('data:loaded', {
        detail: {
          table,
          id: numericId,
          record,
          requestId,
          found: !!record
        },
        bubbles: true
      }));
    } catch (error) {
      console.error('Error in data:load:', error);
      document.dispatchEvent(new CustomEvent('data:error', {
        detail: {
          operation: 'load',
          table: event.detail.table,
          id: event.detail.id,
          error: {
            message: error.message,
            code: error.name || 'LOAD_ERROR'
          }
        },
        bubbles: true
      }));
    }
  }

  async handleClear(event) {
    try {
      const { table } = event.detail;
      
      if (table) {
        if (!this.db[table]) {
          throw new Error(`Table '${table}' does not exist`);
        }
        await this.db[table].clear();
      } else {
        // Clear all tables
        const tables = this.db.tables;
        await Promise.all(tables.map(table => table.clear()));
      }
      
      document.dispatchEvent(new CustomEvent('data:cleared', {
        detail: { table: table || 'all' },
        bubbles: true
      }));
    } catch (error) {
      console.error('Error in data:clear:', error);
      document.dispatchEvent(new CustomEvent('data:error', {
        detail: {
          operation: 'clear',
          table: event.detail.table,
          error: {
            message: error.message,
            code: error.name || 'CLEAR_ERROR'
          }
        },
        bubbles: true
      }));
    }
  }

  // Advanced Dexie-specific methods (still exposed via events)
  async handleAdvancedQuery(event) {
    try {
      const { table, where, orderBy, limit, offset, requestId } = event.detail;
      
      let collection = this.db[table];
      
      // Apply where clauses
      if (where) {
        Object.entries(where).forEach(([field, condition]) => {
          if (typeof condition === 'object') {
            const { operator, value } = condition;
            switch (operator) {
              case 'above':
                collection = collection.where(field).above(value);
                break;
              case 'below':
                collection = collection.where(field).below(value);
                break;
              case 'between':
                collection = collection.where(field).between(value[0], value[1]);
                break;
              case 'anyOf':
                collection = collection.where(field).anyOf(value);
                break;
            }
          } else {
            collection = collection.where(field).equals(condition);
          }
        });
      }
      
      // Apply ordering
      if (orderBy) {
        collection = collection.orderBy(orderBy);
      }
      
      // Apply pagination
      if (offset) {
        collection = collection.offset(offset);
      }
      if (limit) {
        collection = collection.limit(limit);
      }
      
      const results = await collection.toArray();
      
      document.dispatchEvent(new CustomEvent('data:queried', {
        detail: {
          table,
          results,
          requestId,
          count: results.length,
          advanced: true
        },
        bubbles: true
      }));
    } catch (error) {
      console.error('Error in advanced query:', error);
      document.dispatchEvent(new CustomEvent('data:error', {
        detail: {
          operation: 'advanced_query',
          table: event.detail.table,
          error: {
            message: error.message,
            code: error.name || 'ADVANCED_QUERY_ERROR'
          }
        },
        bubbles: true
      }));
    }
  }

  // Cleanup
  async destroy() {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
    
    // Note: Dexie.on.storagemutated doesn't provide a direct way to unsubscribe individual handlers
    // The subscription will be cleaned up when the page unloads
  }
}

console.log('DexieDataEventStore loaded');