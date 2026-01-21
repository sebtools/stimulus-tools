/**
 * DataEventStore - Supabase Implementation
 * 
 * Provides universal data events using an existing Supabase client instance.
 * Listens for data:* events and emits data:* events in response to real-time changes.
 */

export default class SupabaseDataEventStore {
  constructor(supabaseClient) {
    if (!supabaseClient) {
      throw new Error('SupabaseDataEventStore requires a Supabase client instance');
    }
    
    this.client = supabaseClient;
    this.subscriptions = new Map();
    this.isInitialized = false;
  }

  async initialize(tableList = []) {
    if (this.isInitialized) return;
    
    this.setupDataEventListeners();
    
    // Set up real-time subscriptions for specified tables
    if (tableList.length > 0) {
      this.setupRealtimeSubscriptions(tableList);
    }
    
    this.isInitialized = true;
    console.log('SupabaseDataEventStore initialized');
  }

  setupDataEventListeners() {
    // Listen for universal data events
    document.addEventListener('data:save', this.handleSave.bind(this));
    document.addEventListener('data:delete', this.handleDelete.bind(this));
    document.addEventListener('data:query', this.handleQuery.bind(this));
    document.addEventListener('data:load', this.handleLoad.bind(this));
    document.addEventListener('data:clear', this.handleClear.bind(this));
  }

  setupRealtimeSubscriptions(tableList) {
    // Subscribe to real-time changes for each table
    tableList.forEach(tableName => {
      const subscription = this.client
        .channel(`${tableName}_changes`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: tableName
        }, (payload) => {
          document.dispatchEvent(new CustomEvent('data:saved', {
            detail: {
              table: tableName,
              record: payload.new,
              operation: 'create'
            },
            bubbles: true
          }));
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: tableName
        }, (payload) => {
          document.dispatchEvent(new CustomEvent('data:changed', {
            detail: {
              table: tableName,
              id: payload.new.id,
              record: payload.new,
              oldRecord: payload.old,
              operation: 'update'
            },
            bubbles: true
          }));
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: tableName
        }, (payload) => {
          document.dispatchEvent(new CustomEvent('data:deleted', {
            detail: {
              table: tableName,
              id: payload.old.id,
              record: payload.old,
              operation: 'delete'
            },
            bubbles: true
          }));
        })
        .subscribe();

      this.subscriptions.set(tableName, subscription);
    });
  }

  async handleSave(event) {
    try {
      const { table, record } = event.detail;

      // Determine operation type
      const hasId = record.id !== undefined && record.id !== null && record.id !== '';
      const operation = hasId ? 'update' : 'create';

      // 🎯 NEW: Fire before-save event to allow record modification
      const beforeSaveEvent = new CustomEvent('data:before-save', {
        detail: {
          table,
          record,  // Pass by reference - listeners can modify
          operation,
          target: 'supabase'
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

      if (recordToSave.id) {
        // Update existing record
        const { data, error } = await this.client
          .from(table)
          .update(recordToSave)
          .eq('id', recordToSave.id)
          .select()
          .single();

        if (error) throw error;

        // Real-time subscription will emit data:changed event
      } else {
        // Create new record
        const { data, error } = await this.client
          .from(table)
          .insert([recordToSave])
          .select()
          .single();

        if (error) throw error;

        // Real-time subscription will emit data:saved event
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
            code: error.code || 'SAVE_ERROR'
          }
        },
        bubbles: true
      }));
    }
  }

  async handleDelete(event) {
    try {
      const { table, id } = event.detail;

      const { error } = await this.client
        .from(table)
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Real-time subscription will emit data:deleted event
    } catch (error) {
      console.error('Error in data:delete:', error);
      document.dispatchEvent(new CustomEvent('data:error', {
        detail: {
          operation: 'delete',
          table: event.detail.table,
          id: event.detail.id,
          error: {
            message: error.message,
            code: error.code || 'DELETE_ERROR'
          }
        },
        bubbles: true
      }));
    }
  }

  async handleQuery(event) {
    try {
      const { table, filter = {}, requestId } = event.detail;

      let query = this.client.from(table).select();

      // Apply filters
      Object.entries(filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });

      const { data, error } = await query;

      if (error) throw error;

      document.dispatchEvent(new CustomEvent('data:queried', {
        detail: {
          table,
          results: data || [],
          filter,
          requestId,
          count: data ? data.length : 0
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
            code: error.code || 'QUERY_ERROR'
          }
        },
        bubbles: true
      }));
    }
  }

  async handleLoad(event) {
    try {
      const { table, id, requestId } = event.detail;

      const { data, error } = await this.client
        .from(table)
        .select()
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw error;
      }

      document.dispatchEvent(new CustomEvent('data:loaded', {
        detail: {
          table,
          id,
          record: data,
          requestId,
          found: !!data
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
            code: error.code || 'LOAD_ERROR'
          }
        },
        bubbles: true
      }));
    }
  }

  async handleClear(event) {
    try {
      const { table } = event.detail;

      if (!table) {
        throw new Error('Table name is required for clear operation in Supabase');
      }

      // Note: Be very careful with this operation!
      const { error } = await this.client
        .from(table)
        .delete()
        .neq('id', 0); // This will delete all records where id is not 0

      if (error) throw error;

      document.dispatchEvent(new CustomEvent('data:cleared', {
        detail: { table },
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
            code: error.code || 'CLEAR_ERROR'
          }
        },
        bubbles: true
      }));
    }
  }

  // Advanced Supabase-specific queries
  async handleAdvancedQuery(event) {
    try {
      const { table, select, filters, orderBy, limit, requestId } = event.detail;

      let query = this.client.from(table).select(select || '*');

      // Apply advanced filters
      if (filters) {
        Object.entries(filters).forEach(([field, condition]) => {
          if (typeof condition === 'object') {
            const { operator, value } = condition;
            switch (operator) {
              case 'gte':
                query = query.gte(field, value);
                break;
              case 'lte':
                query = query.lte(field, value);
                break;
              case 'like':
                query = query.like(field, value);
                break;
              case 'in':
                query = query.in(field, value);
                break;
              case 'neq':
                query = query.neq(field, value);
                break;
            }
          } else {
            query = query.eq(field, condition);
          }
        });
      }

      if (orderBy) {
        query = query.order(orderBy.field, { ascending: orderBy.ascending !== false });
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      document.dispatchEvent(new CustomEvent('data:queried', {
        detail: {
          table,
          results: data || [],
          requestId,
          count: data ? data.length : 0,
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
            code: error.code || 'ADVANCED_QUERY_ERROR'
          }
        },
        bubbles: true
      }));
    }
  }

  // Cleanup
  async destroy() {
    // Unsubscribe from all real-time subscriptions
    this.subscriptions.forEach(subscription => {
      this.client.removeChannel(subscription);
    });
    this.subscriptions.clear();
    this.isInitialized = false;
  }
}

console.log('SupabaseDataEventStore loaded');