/**
 * Data Event Bridge - React
 * 
 * Translation layer between React component events and DataEventStore events.
 * This allows React components to interact with the universal data layer.
 * 
 * React component event conventions:
 * - react:item:save → data:save
 * - react:item:delete → data:delete  
 * - react:collection:query → data:query
 * 
 * Data events to React:
 * - data:saved → react:item:created
 * - data:changed → react:item:updated
 * - data:deleted → react:item:removed
 */

export default class DataEventBridgeReact {
  constructor(mapping = {}) {
    this.mapping = {
      tableMapping: {},
      fieldMapping: {},
      ...mapping
    };
    
    this.setupEventTranslation();
    console.log('DataEventBridgeReact initialized');
  }

  setupEventTranslation() {
    this.setupReactToDataTranslation();
    this.setupDataToReactTranslation();
  }

  setupReactToDataTranslation() {
    // React → Data Events
    
    document.addEventListener('react:item:save', (e) => {
      const { collection, item } = e.detail;
      
      document.dispatchEvent(new CustomEvent('data:save', {
        detail: {
          table: this.mapTableName(collection),
          record: this.mapFields(collection, item)
        },
        bubbles: true
      }));
    });

    document.addEventListener('react:item:delete', (e) => {
      const { collection, id } = e.detail;
      
      document.dispatchEvent(new CustomEvent('data:delete', {
        detail: {
          table: this.mapTableName(collection),
          id
        },
        bubbles: true
      }));
    });

    document.addEventListener('react:collection:query', (e) => {
      const { collection, filter, requestId } = e.detail;
      
      document.dispatchEvent(new CustomEvent('data:query', {
        detail: {
          table: this.mapTableName(collection),
          filter: this.mapFields(collection, filter || {}),
          requestId
        },
        bubbles: true
      }));
    });

    document.addEventListener('react:item:load', (e) => {
      const { collection, id, requestId } = e.detail;
      
      document.dispatchEvent(new CustomEvent('data:load', {
        detail: {
          table: this.mapTableName(collection),
          id,
          requestId
        },
        bubbles: true
      }));
    });
  }

  setupDataToReactTranslation() {
    // Data → React Events
    
    document.addEventListener('data:saved', (e) => {
      const { table, record, operation } = e.detail;
      const logicalTable = this.unmapTableName(table);
      const logicalRecord = this.unmapFields(logicalTable, record);
      
      document.dispatchEvent(new CustomEvent('react:item:created', {
        detail: {
          collection: logicalTable,
          item: logicalRecord,
          operation
        },
        bubbles: true
      }));
    });

    document.addEventListener('data:changed', (e) => {
      const { table, id, record, oldRecord, operation } = e.detail;
      const logicalTable = this.unmapTableName(table);
      const logicalRecord = this.unmapFields(logicalTable, record);
      const logicalOldRecord = oldRecord ? this.unmapFields(logicalTable, oldRecord) : null;
      
      document.dispatchEvent(new CustomEvent('react:item:updated', {
        detail: {
          collection: logicalTable,
          id,
          item: logicalRecord,
          previousItem: logicalOldRecord,
          operation
        },
        bubbles: true
      }));
    });

    document.addEventListener('data:deleted', (e) => {
      const { table, id, record, operation } = e.detail;
      const logicalTable = this.unmapTableName(table);
      const logicalRecord = this.unmapFields(logicalTable, record);
      
      document.dispatchEvent(new CustomEvent('react:item:removed', {
        detail: {
          collection: logicalTable,
          id,
          item: logicalRecord,
          operation
        },
        bubbles: true
      }));
    });

    document.addEventListener('data:queried', (e) => {
      const { table, results, filter, requestId, count } = e.detail;
      const logicalTable = this.unmapTableName(table);
      const logicalResults = results.map(record => this.unmapFields(logicalTable, record));
      const logicalFilter = filter ? this.unmapFields(logicalTable, filter) : null;
      
      document.dispatchEvent(new CustomEvent('react:collection:loaded', {
        detail: {
          collection: logicalTable,
          items: logicalResults,
          filter: logicalFilter,
          requestId,
          count
        },
        bubbles: true
      }));
    });

    document.addEventListener('data:loaded', (e) => {
      const { table, id, record, requestId, found } = e.detail;
      const logicalTable = this.unmapTableName(table);
      const logicalRecord = record ? this.unmapFields(logicalTable, record) : null;
      
      document.dispatchEvent(new CustomEvent('react:item:loaded', {
        detail: {
          collection: logicalTable,
          id,
          item: logicalRecord,
          requestId,
          found
        },
        bubbles: true
      }));
    });

    document.addEventListener('data:error', (e) => {
      const { operation, table, error, ...otherDetails } = e.detail;
      const logicalTable = table ? this.unmapTableName(table) : null;
      
      document.dispatchEvent(new CustomEvent('react:error', {
        detail: {
          operation,
          collection: logicalTable,
          error,
          ...otherDetails
        },
        bubbles: true
      }));
    });
  }

  // Same mapping methods as record bridge
  mapTableName(logicalTable) {
    return this.mapping.tableMapping?.[logicalTable] || logicalTable;
  }

  unmapTableName(actualTable) {
    const entry = Object.entries(this.mapping.tableMapping || {})
      .find(([logical, actual]) => actual === actualTable);
    return entry ? entry[0] : actualTable;
  }

  mapFields(table, record) {
    if (!record || typeof record !== 'object') return record;

    const tableFieldMapping = this.mapping.fieldMapping?.[table] || {};
    const globalFieldMapping = this.mapping.fieldMapping || {};
    
    const mapped = {};
    Object.entries(record).forEach(([logicalField, value]) => {
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

  updateMapping(newMapping) {
    this.mapping = { ...this.mapping, ...newMapping };
  }

  getMapping() {
    return { ...this.mapping };
  }
}

console.log('DataEventBridgeReact loaded');