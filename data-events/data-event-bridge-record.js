/**
 * Data Event Bridge - Record Controller
 * 
 * Translation layer between Record Controller events and DataEventStore events.
 * This bridge is completely storage-agnostic - it works with any DataEventStore implementation.
 * 
 * Translates between:
 * - record:ui:* events (from Record Controller) → data:* events (to DataEventStore)
 * - data:* events (from DataEventStore) → record:data:* events (to Record Controller)
 * 
 * Also handles table and field name mapping between logical names (used by UI) 
 * and physical names (used by storage).
 */

export default class DataEventBridgeRecord {
  constructor(mapping = {}) {
    this.mapping = {
      tableMapping: {},
      fieldMapping: {},
      ...mapping
    };
    
    this.setupEventTranslation();
    console.log('DataEventBridgeRecord initialized');
  }

  setupEventTranslation() {
    this.setupUIToDataTranslation();
    this.setupDataToUITranslation();
  }

  setupUIToDataTranslation() {
    // Record UI → Data Events (with mapping)
    
    document.addEventListener('record:ui:add', (e) => {
      const { table, record } = e.detail;
      
      document.dispatchEvent(new CustomEvent('data:save', {
        detail: {
          table: this.mapTableName(table),
          record: this.mapFields(table, record)
        },
        bubbles: true
      }));
    });

    document.addEventListener('record:ui:update', (e) => {
      const { table, id, record } = e.detail;
      
      document.dispatchEvent(new CustomEvent('data:save', {
        detail: {
          table: this.mapTableName(table),
          record: this.mapFields(table, { ...record, id })
        },
        bubbles: true
      }));
    });

    document.addEventListener('record:ui:delete', (e) => {
      const { table, id } = e.detail;
      
      document.dispatchEvent(new CustomEvent('data:delete', {
        detail: {
          table: this.mapTableName(table),
          id
        },
        bubbles: true
      }));
    });

    document.addEventListener('record:ui:sort', (e) => {
      const { table, order } = e.detail;
      
      document.dispatchEvent(new CustomEvent('data:sort', {
        detail: {
          table: this.mapTableName(table),
          order
        },
        bubbles: true
      }));
    });

    document.addEventListener('record:ui:query', (e) => {
      const { table, filter, requestId } = e.detail;
      
      document.dispatchEvent(new CustomEvent('data:query', {
        detail: {
          table: this.mapTableName(table),
          filter: this.mapFields(table, filter || {}),
          requestId
        },
        bubbles: true
      }));
    });

    document.addEventListener('record:ui:load', (e) => {
      const { table, id, requestId } = e.detail;
      
      document.dispatchEvent(new CustomEvent('data:load', {
        detail: {
          table: this.mapTableName(table),
          id,
          requestId
        },
        bubbles: true
      }));
    });
  }

  setupDataToUITranslation() {
    // Data Events → Record Data Events (with reverse mapping)
    
    document.addEventListener('data:saved', (e) => {
      const { table, record, operation } = e.detail;
      const logicalTable = this.unmapTableName(table);
      const logicalRecord = this.unmapFields(logicalTable, record);
      
      document.dispatchEvent(new CustomEvent('record:data:add', {
        detail: { 
          table: logicalTable, 
          record: logicalRecord, 
          id: logicalRecord.id,
        },
        bubbles: true
      }));
    });

    document.addEventListener('data:changed', (e) => {
      const { table, id, record, oldRecord, operation } = e.detail;
      const logicalTable = this.unmapTableName(table);
      const logicalRecord = this.unmapFields(logicalTable, record);
      const logicalOldRecord = oldRecord ? this.unmapFields(logicalTable, oldRecord) : null;
      
      document.dispatchEvent(new CustomEvent('record:data:update', {
        detail: { 
          table: logicalTable, 
          id, 
          record: logicalRecord,
          oldRecord: logicalOldRecord,
          operation 
        },
        bubbles: true
      }));
    });

    document.addEventListener('data:deleted', (e) => {
      const { table, id, record, operation } = e.detail;
      const logicalTable = this.unmapTableName(table);
      const logicalRecord = this.unmapFields(logicalTable, record);
      
      document.dispatchEvent(new CustomEvent('record:data:delete', {
        detail: { 
          table: logicalTable, 
          id, 
          record: logicalRecord, 
          operation 
        },
        bubbles: true
      }));
    });

    document.addEventListener('data:queried', (e) => {
      const { table, results, filter, requestId, count, advanced } = e.detail;
      const logicalTable = this.unmapTableName(table);
      const logicalResults = results.map(record => this.unmapFields(logicalTable, record));
      const logicalFilter = filter ? this.unmapFields(logicalTable, filter) : null;
      
      document.dispatchEvent(new CustomEvent('record:data:queried', {
        detail: {
          table: logicalTable,
          results: logicalResults,
          filter: logicalFilter,
          requestId,
          count,
          advanced
        },
        bubbles: true
      }));
    });

    document.addEventListener('data:loaded', (e) => {
      const { table, id, record, requestId, found } = e.detail;
      const logicalTable = this.unmapTableName(table);
      const logicalRecord = record ? this.unmapFields(logicalTable, record) : null;
      
      document.dispatchEvent(new CustomEvent('record:data:loaded', {
        detail: {
          table: logicalTable,
          id,
          record: logicalRecord,
          requestId,
          found
        },
        bubbles: true
      }));
    });

    document.addEventListener('data:error', (e) => {
      const { operation, table, error, ...otherDetails } = e.detail;
      const logicalTable = table ? this.unmapTableName(table) : null;
      
      document.dispatchEvent(new CustomEvent('record:data:error', {
        detail: {
          operation,
          table: logicalTable,
          error,
          ...otherDetails
        },
        bubbles: true
      }));
    });

    document.addEventListener('data:cleared', (e) => {
      const { table } = e.detail;
      const logicalTable = table !== 'all' ? this.unmapTableName(table) : 'all';
      
      document.dispatchEvent(new CustomEvent('record:data:cleared', {
        detail: { table: logicalTable },
        bubbles: true
      }));
    });
  }

  // Table name mapping methods
  mapTableName(logicalTable) {
    return this.mapping.tableMapping?.[logicalTable] || logicalTable;
  }

  unmapTableName(actualTable) {
    // Reverse lookup: find logical name for actual table name
    const entry = Object.entries(this.mapping.tableMapping || {})
      .find(([logical, actual]) => actual === actualTable);
    return entry ? entry[0] : actualTable;
  }

  // Field mapping methods
  mapFields(table, record) {
    if (!record || typeof record !== 'object') return record;

    const tableFieldMapping = this.mapping.fieldMapping?.[table] || {};
    const globalFieldMapping = this.mapping.fieldMapping || {};
    
    const mapped = {};
    Object.entries(record).forEach(([logicalField, value]) => {
      // Check table-specific mapping first, then global mapping
      const actualField = tableFieldMapping[logicalField] || 
                         globalFieldMapping[logicalField] || 
                         logicalField;
      mapped[actualField] = value;
    });
    
    return mapped;
  }

  unmapFields(table, record) {
    if (!record || typeof record !== 'object') return record;

    const tableFieldMapping = this.mapping.fieldMapping?.[table] || {};
    const globalFieldMapping = this.mapping.fieldMapping || {};
    
    // Create reverse mapping
    const reverseMapping = {};
    Object.entries(tableFieldMapping).forEach(([logical, actual]) => {
      reverseMapping[actual] = logical;
    });
    Object.entries(globalFieldMapping).forEach(([logical, actual]) => {
      if (!reverseMapping[actual]) {
        reverseMapping[actual] = logical;
      }
    });
    
    const unmapped = {};
    Object.entries(record).forEach(([actualField, value]) => {
      const logicalField = reverseMapping[actualField] || actualField;
      unmapped[logicalField] = value;
    });
    
    return unmapped;
  }

  // Utility methods
  updateMapping(newMapping) {
    this.mapping = {
      tableMapping: {},
      fieldMapping: {},
      ...this.mapping,
      ...newMapping
    };
  }

  getMapping() {
    return { ...this.mapping };
  }

  // For debugging/testing
  logEventFlow(enabled = true) {
    if (!enabled) return;

    const logEvent = (eventName, color) => {
      document.addEventListener(eventName, (e) => {
        console.log(`%c${eventName}`, `color: ${color}; font-weight: bold`, e.detail);
      });
    };

    // UI events (blue)
    logEvent('record:ui:add', '#0066cc');
    logEvent('record:ui:update', '#0066cc');
    logEvent('record:ui:delete', '#0066cc');

    // Data events (green)
    logEvent('data:save', '#006600');
    logEvent('data:delete', '#006600');
    logEvent('data:saved', '#009900');
    logEvent('data:changed', '#009900');
    logEvent('data:deleted', '#009900');

    // UI response events (purple)
    logEvent('record:ui:added', '#6600cc');
    logEvent('record:ui:changed', '#6600cc');
    logEvent('record:ui:deleted', '#6600cc');
  }

}

console.log('DataEventBridgeRecord loaded');