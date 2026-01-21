/**
 * DataEventStore - Memory Implementation
 * 
 * Provides universal data events using an existing Map-based storage instance.
 * Useful for development, testing, and scenarios where persistence isn't needed.
 */

export default class MemoryDataEventStore {
  constructor(storageMap = null) {
    // Accept an existing Map or create a new one
    this.data = storageMap || new Map(); // table_name -> Map(id -> record)
    this.nextId = 1;
    this.isInitialized = false;
    
    // If using existing storage, try to determine next ID
    if (storageMap) {
      this.calculateNextId();
    }
  }

  calculateNextId() {
    let maxId = 0;
    this.data.forEach(tableData => {
      tableData.forEach(record => {
        if (typeof record.id === 'number' && record.id > maxId) {
          maxId = record.id;
        }
      });
    });
    this.nextId = maxId + 1;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    this.setupDataEventListeners();
    this.isInitialized = true;
    console.log('MemoryDataEventStore initialized');
  }

  setupDataEventListeners() {
    // Listen for universal data events
    document.addEventListener('data:save', this.handleSave.bind(this));
    document.addEventListener('data:delete', this.handleDelete.bind(this));
    document.addEventListener('data:query', this.handleQuery.bind(this));
    document.addEventListener('data:load', this.handleLoad.bind(this));
    document.addEventListener('data:clear', this.handleClear.bind(this));
  }

  getTable(tableName) {
    if (!this.data.has(tableName)) {
      this.data.set(tableName, new Map());
    }
    return this.data.get(tableName);
  }

  generateId() {
    return this.nextId++;
  }

  async handleSave(event) {
    try {
      const { table, record } = event.detail;
      const tableData = this.getTable(table);
      
      let savedRecord;
      let operation;
      
      if (record.id && tableData.has(record.id)) {
        // Update existing
        savedRecord = {
          ...tableData.get(record.id),
          ...record,
          updated_at: new Date()
        };
        tableData.set(record.id, savedRecord);
        operation = 'update';
        
        document.dispatchEvent(new CustomEvent('data:changed', {
          detail: {
            table,
            id: record.id,
            record: savedRecord,
            operation
          },
          bubbles: true
        }));
      } else {
        // Create new
        const id = record.id || this.generateId();
        savedRecord = {
          ...record,
          id,
          created_at: new Date(),
          updated_at: new Date()
        };
        tableData.set(id, savedRecord);
        operation = 'create';
        
        document.dispatchEvent(new CustomEvent('data:saved', {
          detail: {
            table,
            record: savedRecord,
            operation
          },
          bubbles: true
        }));
      }
    } catch (error) {
      console.error('Error in data:save:', error);
      document.dispatchEvent(new CustomEvent('data:error', {
        detail: {
          operation: 'save',
          table: event.detail.table,
          record: event.detail.record,
          error: {
            message: error.message,
            code: 'SAVE_ERROR'
          }
        },
        bubbles: true
      }));
    }
  }

  async handleDelete(event) {
    try {
      const { table, id } = event.detail;
      const tableData = this.getTable(table);
      
      if (!tableData.has(id)) {
        throw new Error(`Record with id ${id} not found in table ${table}`);
      }

      const deletedRecord = tableData.get(id);
      tableData.delete(id);
      
      document.dispatchEvent(new CustomEvent('data:deleted', {
        detail: {
          table,
          id,
          record: deletedRecord,
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
            code: 'DELETE_ERROR'
          }
        },
        bubbles: true
      }));
    }
  }

  async handleQuery(event) {
    try {
      const { table, filter = {}, requestId } = event.detail;
      const tableData = this.getTable(table);
      
      let results = Array.from(tableData.values());
      
      // Apply simple filters
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          results = results.filter(record => record[key] === value);
        }
      });
      
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
            code: 'QUERY_ERROR'
          }
        },
        bubbles: true
      }));
    }
  }

  async handleLoad(event) {
    try {
      const { table, id, requestId } = event.detail;
      const tableData = this.getTable(table);
      
      const record = tableData.get(id) || null;
      
      document.dispatchEvent(new CustomEvent('data:loaded', {
        detail: {
          table,
          id,
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
            code: 'LOAD_ERROR'
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
        const tableData = this.getTable(table);
        tableData.clear();
      } else {
        // Clear all tables
        this.data.clear();
        this.nextId = 1;
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
            code: 'CLEAR_ERROR'
          }
        },
        bubbles: true
      }));
    }
  }

  // Utility methods for testing/debugging
  getAllData() {
    const result = {};
    this.data.forEach((tableData, tableName) => {
      result[tableName] = Array.from(tableData.values());
    });
    return result;
  }

  getTableCount(tableName) {
    return this.getTable(tableName).size;
  }

  async destroy() {
    this.data.clear();
    this.nextId = 1;
    this.isInitialized = false;
  }
}

console.log('MemoryDataEventStore loaded');