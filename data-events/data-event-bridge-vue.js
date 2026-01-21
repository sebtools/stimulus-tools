/**
 * Data Event Bridge - Vue
 * 
 * Translation layer between Vue component events and DataEventStore events.
 * This allows Vue components to interact with the universal data layer.
 * 
 * Vue component event conventions:
 * - vue:resource:save → data:save
 * - vue:resource:delete → data:delete  
 * - vue:resource:fetch → data:query
 * 
 * Data events to Vue:
 * - data:saved → vue:resource:created
 * - data:changed → vue:resource:updated
 * - data:deleted → vue:resource:destroyed
 */

export default class DataEventBridgeVue {
  constructor(mapping = {}) {
    this.mapping = {
      tableMapping: {},
      fieldMapping: {},
      ...mapping
    };
    
    this.setupEventTranslation();
    console.log('DataEventBridgeVue initialized');
  }

  setupEventTranslation() {
    this.setupVueToDataTranslation();
    this.setupDataToVueTranslation();
  }

  setupVueToDataTranslation() {
    // Vue → Data Events
    
    document.addEventListener('vue:resource:save', (e) => {
      const { resource, data } = e.detail;
      
      document.dispatchEvent(new CustomEvent('data:save', {
        detail: {
          table: this.mapTableName(resource),
          record: this.mapFields(resource, data)
        },
        bubbles: true
      }));
    });

    document.addEventListener('vue:resource:delete', (e) => {
      const { resource, id } = e.detail;
      
      document.dispatchEvent(new CustomEvent('data:delete', {
        detail: {
          table: this.mapTableName(resource),
          id
        },
        bubbles: true
      }));
    });

    document.addEventListener('vue:resource:fetch', (e) => {
      const { resource, params, requestId } = e.detail;
      
      document.dispatchEvent(new CustomEvent('data:query', {
        detail: {
          table: this.mapTableName(resource),
          filter: this.mapFields(resource, params || {}),
          requestId
        },
        bubbles: true
      }));
    });

    document.addEventListener('vue:resource:find', (e) => {
      const { resource, id, requestId } = e.detail;
      
      document.dispatchEvent(new CustomEvent('data:load', {
        detail: {
          table: this.mapTableName(resource),
          id,
          requestId
        },
        bubbles: true
      }));
    });
  }

  setupDataToVueTranslation() {
    // Data → Vue Events
    
    document.addEventListener('data:saved', (e) => {
      const { table, record, operation } = e.detail;
      const logicalTable = this.unmapTableName(table);
      const logicalRecord = this.unmapFields(logicalTable, record);
      
      document.dispatchEvent(new CustomEvent('vue:resource:created', {
        detail: {
          resource: logicalTable,
          data: logicalRecord,
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
      
      document.dispatchEvent(new CustomEvent('vue:resource:updated', {
        detail: {
          resource: logicalTable,
          id,
          data: logicalRecord,
          previousData: logicalOldRecord,
          operation
        },
        bubbles: true
      }));
    });

    document.addEventListener('data:deleted', (e) => {
      const { table, id, record, operation } = e.detail;
      const logicalTable = this.unmapTableName(table);
      const logicalRecord = this.unmapFields(logicalTable, record);
      
      document.dispatchEvent(new CustomEvent('vue:resource:destroyed', {
        detail: {
          resource: logicalTable,
          id,
          data: logicalRecord,
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
      
      document.dispatchEvent(new CustomEvent('vue:resource:fetched', {
        detail: {
          resource: logicalTable,
          results: logicalResults,
          params: logicalFilter,
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
      
      document.dispatchEvent(new CustomEvent('vue:resource:found', {
        detail: {
          resource: logicalTable,
          id,
          data: logicalRecord,
          requestId,
          found
        },
        bubbles: true
      }));
    });

    document.addEventListener('data:error', (e) => {
      const { operation, table, error, ...otherDetails } = e.detail;
      const logicalTable = table ? this.unmapTableName(table) : null;
      
      document.dispatchEvent(new CustomEvent('vue:error', {
        detail: {
          operation,
          resource: logicalTable,
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

console.log('DataEventBridgeVue loaded');