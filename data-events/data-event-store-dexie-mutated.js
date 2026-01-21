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
    this.knownIds = {}; // Track known IDs per table for create vs update detection
    this.storageMutationSetup = false;
    
    // Validate database instance
    if (typeof this.db.open !== 'function') {
      throw new Error('Invalid Dexie database instance provided');
    }
  }

  // Helper method to validate database state
  validateDatabase() {
    if (!this.db) {
      throw new Error('Database instance is null');
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
    
    try {
      // Ensure the database is open
      if (!this.db.isOpen()) {
        await this.db.open();
      }
      
      // Validate database state
      const tables = this.validateDatabase();
      console.log(`Database validation successful. Available tables: ${tables.join(', ')}`);
      
      // Set up data event listeners (these are safe)
      this.setupDataEventListeners();
      
      // Build initial ID index for create vs update detection
      await this.buildInitialIdIndex();
      
      // Set up storage mutation listeners using storagemutated
      this.setupStorageMutationListener();
      
      this.isInitialized = true;
      console.log(`DexieDataEventStore initialized with database: ${this.db.name}`);
    } catch (error) {
      console.error('Error initializing DexieDataEventStore:', error);
      
      // Set up data event listeners even if validation fails
      this.setupDataEventListeners();
      this.isInitialized = true;
      
      console.warn('Initialized with limited functionality - storage mutation detection may not work');
      // Don't throw - let it work without change listeners
    }
  }

  setupDataEventListeners() {
    // Listen for universal data events
    document.addEventListener('data:save', this.handleSave.bind(this));
    document.addEventListener('data:delete', this.handleDelete.bind(this));
    document.addEventListener('data:query', this.handleQuery.bind(this));
    document.addEventListener('data:load', this.handleLoad.bind(this));
    document.addEventListener('data:clear', this.handleClear.bind(this));
  }

  setupStorageEventListeners() {
    // This method is deprecated - now using setupStorageMutationListener
    console.log('Legacy storage event listeners setup - using storagemutated instead');
  }

  // Build initial index of known IDs for create vs update detection
  async buildInitialIdIndex() {
    try {
      this.knownIds = {};
      const tables = Object.keys(this.db._dbSchema || {});
      
      for (const tableName of tables) {
        const ids = await this.db[tableName].orderBy(':id').primaryKeys();
        this.knownIds[tableName] = new Set(ids);
        console.log(`Indexed ${ids.length} existing ${tableName} records`);
      }
      
      console.log('Initial ID index built successfully');
    } catch (error) {
      console.warn('Failed to build initial ID index:', error.message);
      // Initialize empty sets for all tables
      const tables = Object.keys(this.db._dbSchema || {});
      tables.forEach(tableName => {
        this.knownIds[tableName] = new Set();
      });
    }
  }

  // Set up storage mutation listener using Dexie.on.storagemutated
  setupStorageMutationListener() {
    if (this.storageMutationSetup) return;
    
    //try {
      const mutationHandler = async (observabilitySet) => {
        await this.handleStorageMutations(observabilitySet);
      };
      
      // Subscribe to global storage mutations
      //Dexie.on('storagemutated', mutationHandler);
		Dexie.on('storagemutated', event => {
			this.handleStorageMutations(event);
		});
      
      this.storageMutationSetup = true;
      console.log('Storage mutation listener set up successfully using Dexie.on.storagemutated');
    //} catch (error) {
    //  console.warn('Failed to set up storage mutation listener:', error.message);
    //}
  }

  getIdsFromKeys(keys) {
	const ids = [];
	for (const key of keys) {
		//console.log('Original key:', key);
		const id = key.d;
		// Convert string ID to number if numeric
		const id_fixed = typeof id === 'string' && /^\d+$/.test(id) ? parseInt(id, 10) : id;
		ids.push(id_fixed);
	}
	return ids;
  }

  // Handle storage mutations detected by storagemutated
  async handleStorageMutations(observabilitySet) {
	//console.log('Handling storage mutations:', observabilitySet);
	//return;
    //try {
      for (const [partKey, keys] of Object.entries(observabilitySet)) {
        // Parse the part key: "idb://dbName/tableName/indexName"
        const match = partKey.match(/^idb:\/\/([^\/]+)\/([^\/]+)\/(.*)$/);
        if (!match) continue;
        
        const [, dbName, tableName, indexName] = match;

		console.log('Mutation detected:', tableName, indexName, keys);

        // Only process mutations for our database
        if (dbName !== this.db.name) continue;
        
        // Ensure we have a known IDs set for this table
        if (!this.knownIds[tableName]) {
          this.knownIds[tableName] = new Set();
        }

		if (keys.length === 0) {
			continue;
		}

		const ids = this.getIdsFromKeys(keys);
		
		/*
		for (const id of ids) {
			console.log('Mutated ID:', id);
		}
		*/

		console.log(indexName);
        
        if (indexName === ':dels') {
          // Handle deletions
          for (const id of ids) {
            this.knownIds[tableName].delete(id);
            await this.dispatchDeleteEvent(tableName, id);
          }
        } else if (indexName === '') {
          // Handle creates/updates (primary key changes)
          for (const id of ids) {
            const isCreate = !this.knownIds[tableName].has(id);
            
            if (isCreate) {
              this.knownIds[tableName].add(id);
			  console.log('Detected create for', tableName, id);
              await this.dispatchCreateEvent(tableName, id);
            } else {
			  //console.log('Detected update for', tableName, id);
              await this.dispatchUpdateEvent(tableName, id);
            }
          }
        }
        // Ignore other index changes (indexName will be field names)
      }
    //} catch (error) {
    //  console.warn('Error handling storage mutations:', error.message);
    //}
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

  // Legacy setup method - now just calls new implementation
  trySetupStorageListeners() {
    // This method is deprecated in favor of setupStorageMutationListener
    console.log('Legacy trySetupStorageListeners called - using storagemutated approach instead');
  }

  async handleSave(event) {
    //try {
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

      // Ensure we have a known IDs set for this table
      if (!this.knownIds[table]) {
        this.knownIds[table] = new Set();
      }

      let savedRecord;
      let operation;

      // Convert string ID to number for Dexie auto-increment primary key
      const numericId = record.id && typeof record.id === 'string' ? parseInt(record.id, 10) : record.id;
      
      if (numericId && await this.db[table].get(numericId)) {
        // Update existing record
        const updateData = {
          ...record,
          updated_at: new Date()
        };
		// Remove id from record to avoid conflicts with Dexie's auto-increment
		const { id, ...recordWithoutId } = updateData;
		await this.db[table].update(numericId, recordWithoutId);
        //console.log('Updating record:', record);
        
        //await this.db[table].update(numericId, record);
        savedRecord = await this.db[table].get(numericId); // Get updated record
        operation = 'update';
        
        // Note: storagemutated will also fire for this change, but that's okay
        // Manual dispatch ensures immediate response for local operations
        /*
		document.dispatchEvent(new CustomEvent('data:changed', {
          detail: {
            table,
            id: numericId,
            record: savedRecord,
            operation
          },
          bubbles: true
        }));
		*/
      } else {
        // Create new record
        const newData = {
          ...record,
          created_at: new Date(),
          updated_at: new Date()
        };
        const id = await this.db[table].add(newData);
        savedRecord = { ...newData, id };
        operation = 'create';
        
        // Update our ID tracking
        this.knownIds[table].add(id);
        
        // Note: storagemutated will also fire for this change, but that's okay
        // Manual dispatch ensures immediate response for local operations
		/*
        document.dispatchEvent(new CustomEvent('data:saved', {
          detail: {
            table,
            record: savedRecord,
            operation
          },
          bubbles: true
        }));
		*/
      }
    /*
	} catch (error) {
      console.error('Error in data:save:', error);
      document.dispatchEvent(new CustomEvent('data:error', {
        detail: {
          operation: 'save',
          table: event.detail.table,
          record: event.detail.record,
          error: {
            message: error.message,
            code: error.name || 'SAVE_ERROR'
          }
        },
        bubbles: true
      }));
    }
	*/
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
      
      // Update our ID tracking
      if (this.knownIds[table]) {
        this.knownIds[table].delete(numericId);
      }
      
      // Note: storagemutated will also fire for this change, but that's okay
      // Manual dispatch ensures immediate response for local operations
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
      this.storageMutationSetup = false;
      this.knownIds = {};
    }
    
    // Note: Dexie.on.storagemutated doesn't provide a direct way to unsubscribe individual handlers
    // The subscription will be cleaned up when the page unloads
  }
}

console.log('DexieDataEventStore loaded');