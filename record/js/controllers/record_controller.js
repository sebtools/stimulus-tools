application.register('record', class extends Stimulus.Controller {
	static targets = ["save"];

	connect() {
		// Initialize fields and set up observers
		this.initializeFields();
		this.setupEventListeners();
		this.debounceTimeouts = new Map();

		// We want to set up a unique "channel" for every record instance so that we can identify events
		if ( !this.element.hasAttribute('data-record-channel') ) {
			const randomStr = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
			this.element.setAttribute('data-record-channel', randomStr);
		}

		// Set up container-level mutation observer to detect new fields
		this.setupObservers();

		this.element.recordController = this;

		this.ensureAddRecord();

		setTimeout(() => {
			this.runAutoLoads();
		}, 0);

	}

	disconnect() {
		// Fire event before cleanup so external code can access controller data
		this.dispatch('disconnected', {
			detail: this.getEventDetail(),
			prefix: 'record'
		});

		this.removeEventListeners();

		// Clean up mutation observers (container + per-table)
		if ( this.observers ) {
			if ( this.observers.container ) {
				this.observers.container.disconnect();
			}
			if ( this.observers.tableObservers ) {
				this.observers.tableObservers.forEach((obs) => obs.disconnect());
			}
		}
		this.observers = {};

		// Clear any pending debounce timeouts
		this.debounceTimeouts.forEach(timeout => clearTimeout(timeout));
		this.debounceTimeouts.clear();

	}

	// Set up before and listeners for all fields
	initializeFields() {
		
		this.element.querySelectorAll('[data-record-field]').forEach(field => {
			this.initializeField(field);
		});

	}

	// Set up before and listeners for a single field
	initializeField(field) {
		this.#setBeforeValue(field);
		this.#setupFieldListener(field);
	}

		#setBeforeValue(field) {
			field.setAttribute('data-record-before', this.getFieldValue(field));
		}

		#setupFieldListener(field) {
			const events = this.#getFieldEvents(field);

			events.forEach(eventType => {
				field.addEventListener(eventType, (e) => {
					//this.handleFieldChange(field, e);
					this.handleFieldEvent(e);
				});
			});

		}
	
	add() {
		this.insertRecordElement(this.element);
	}

	handleFieldEvent(event) {
		const field = event.target;

		const validkeys = ['Escape', 'Enter', 'ArrowUp', 'ArrowDown'];
		if ( event.type === 'keydown' && !validkeys.includes(event.key) ) {
			return;
		}

		// Escape should just revert the value
		if ( event.key === 'Escape' ) {
			const beforeValue = field.getAttribute('data-record-before');
			// Revert to before value on Escape
			this.setFieldValue(field, beforeValue);
			//field.blur();
			return;
		}

		// input, change, blur, Enter key should trigger change handling
		if (
			event.type === 'input'
			||
			event.type === 'change'
			||
			event.type === 'blur'
			||
			(
				event.type === 'keydown'
				&&
				event.key === 'Enter'
			)
		) {
			this.handleFieldChange(field, event);
		}

		// Up/Down arrow in textarea shouldn't move between fields unless all text is selected
		if ( field.tagName.toLowerCase() === 'textarea' ) {
			const allSelected = (
				field.selectionStart === 0
				&&
				field.selectionEnd === field.value.length
			);
			if ( !allSelected ) {
				return;
			}

		}

		// Handle Up/Down arrow keys for moving between fields
		if ( event.type === 'keydown' ) {
			event.preventDefault();
			switch ( event.key ) {
				case 'ArrowUp':
					this.moveFieldUpDown(field, 'up');
					break;
				case 'ArrowDown':
					this.moveFieldUpDown(field, 'down');
					break;
				case 'Enter':
					// Short delay to allow data to update
					setTimeout(() => {
						this.moveFieldUpDown(field, 'down');
					}, 50);
					break;
			}
		}

	}

	handleRecordIdChange(element, oldValue) {
		const detail = this.getEventDetail(element);
		
		// Check if this was an empty record that just got assigned an ID
		if ( oldValue === '' && element.getAttribute('data-record-id') !== '' ) {
			// Ensure there is still an empty record
			this.ensureAddRecord(element);
		}

		this.dispatch('updated', {
			detail,
			prefix: 'record:ui'
		});

		// If id was just assigned, and autoload is enabled for this element/table/controller,
		// trigger a single-record load so the record's fields can be reconciled with the backend.
		if ( oldValue === '' && element.getAttribute('data-record-id') !== '' ) {
			if ( this.isAutoloadEnabledForElement(element) ) {
				this.requestRecordLoad(element);
			}
		}

	}
	
	handleSortComplete(event) {
		const element = event.detail.element || this.element;

		this.broadcastSortEvent(element);
	}

	moveFieldUpDown(field, direction) {

		// Validate direction
		if ( direction !== 'up' && direction !== 'down' ) {
			return;
		}

		// Validate element type
		const tag = field.tagName.toLowerCase();
		if ( tag !== 'input' && tag !== 'textarea' ) {
			return;
		}

		const name = field.getAttribute('data-record-field');

		// Only proceed if name attribute exists
		if ( !name ) {
			return;
		}

		const nameInputs = document.querySelectorAll(`${tag}[data-record-field="${name}"]`);
		const currentIndex = Array.from(nameInputs).indexOf(field);
		let targetIndex;
		if ( direction === 'up' ) {
			targetIndex = currentIndex > 0 ? currentIndex - 1 : nameInputs.length - 1;
		} else if ( direction === 'down' ) {
			targetIndex = currentIndex < nameInputs.length - 1 ? currentIndex + 1 : 0;
		}
		// Focus the target input
		nameInputs[targetIndex].focus();
		nameInputs[targetIndex].select(); // Optional: select all text
	}

		// Determine which events to listen for based on field type
		#getFieldEvents(field) {
			const tagName = field.tagName.toLowerCase();
			
			if ( tagName === 'select' ) {
				return ['change'];
			} else if ( tagName === 'input' || tagName === 'textarea' ) {
				//return ['change', 'blur'];
				return ['input', 'change','blur','keydown'];
			} else if ( field.hasAttribute('contenteditable') ) {
				return ['input', 'blur', 'keydown'];
			} else {
				// For other elements, we'll use MutationObserver
				this.setupMutationObserver(field);
				return [];
			}
		}
	
		setupObservers() {
			// this.observers will hold a container observer and a Map of per-table observers
			this.observers = {
				container: null,
				tableObservers: new Map()
			};
			this.setupContainerMutationObserver();
			this.setupTableObservers();
		}

		setupContainerMutationObserver() {
			// Container observer watches for added/removed nodes so we can attach/detach
			// per-table observers when table elements appear or disappear.
			this.observers.container = new MutationObserver((mutations) => {
				mutations.forEach((mutation) => {
					if ( mutation.type === 'childList' ) {
						// Handle added nodes
						mutation.addedNodes.forEach((node) => {
							if ( node.nodeType === Node.ELEMENT_NODE ) {
								this.processNewElement(node);
								// If a new element (or its descendants) has data-record-table, set up table observer(s)
								if ( node.hasAttribute && node.hasAttribute('data-record-table') ) {
									this.setupTableMutationObserver(node);
								}
								const tables = node.querySelectorAll ? node.querySelectorAll('[data-record-table]') : [];
								tables.forEach(tbl => this.setupTableMutationObserver(tbl));
							}
						});
						// Handle removed nodes to tear down any table observers
						mutation.removedNodes.forEach((node) => {
							if ( node.nodeType === Node.ELEMENT_NODE ) {
								if ( node.hasAttribute && node.hasAttribute('data-record-table') ) {
									this.teardownTableMutationObserver(node);
								}
								const tables = node.querySelectorAll ? node.querySelectorAll('[data-record-table]') : [];
								tables.forEach(tbl => this.teardownTableMutationObserver(tbl));
							}
						});
					}
				});
			});

			this.observers.container.observe(this.element, {
				childList: true,
				subtree: true
			});
		}

		// Find existing table elements inside this controller and set up observers on them
		setupTableObservers() {
			// Include the controller root if it declares a table
			const tables = [];
			if ( this.element.hasAttribute('data-record-table') ) {
				tables.push(this.element);
			}
			this.element.querySelectorAll('[data-record-table]').forEach(el => tables.push(el));
			tables.forEach(el => this.setupTableMutationObserver(el));
		}

		setupTableMutationObserver(tableElement) {
			if ( !tableElement || this.observers.tableObservers.has(tableElement) ) return;
			const observer = new MutationObserver((mutations) => {
				mutations.forEach((mutation) => {
					if ( mutation.type === 'attributes' && mutation.attributeName === 'data-record-id' ) {
						this.handleRecordIdChange(mutation.target, mutation.oldValue);
					}
				});
			});

			observer.observe(tableElement, {
				attributes: true,
				subtree: true,
				attributeFilter: ['data-record-id'],
				attributeOldValue: true
			});

			this.observers.tableObservers.set(tableElement, observer);
		}

		teardownTableMutationObserver(tableElement) {
			if ( !tableElement ) return;
			const obs = this.observers.tableObservers.get(tableElement);
			if ( obs ) {
				obs.disconnect();
				this.observers.tableObservers.delete(tableElement);
			}
		}

	ensureAddRecord(element = null) {
		// Ensure there is always an empty record for adding new entries
		const elem = element || this.element;
		const tableElement = this.getTableElement(elem);

		if ( !this.shouldMaintainAddRecord(tableElement) ) {
			return;
		}
		const emptyRecord = tableElement.querySelector('[data-record-id=""]');
		if ( !emptyRecord ) {
			// Create a new record element (will by default be created relative to this.element)
			const newEl = this.insertRecordElement(elem);
			// If caller provided a different root/container, move the new element into it
			if ( newEl && elem !== tableElement ) {
				tableElement.appendChild(newEl);
			}
		}

	}
	
	// Set up MutationObserver for non-form fields
	setupMutationObserver(field) {
		const observer = new MutationObserver(() => {
			this.handleFieldChange(field);
		});
		
		observer.observe(field, {
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
			attributeFilter: ['data-record-value', 'data-value', 'value']
		});

		// Store observer for cleanup
		if ( !field._recordObserver ) {
			field._recordObserver = observer;
		}
	}


	handleFieldChange(field, event = null) {
		const ignoreType = field.getAttribute('data-record-ignore');
		
		// Skip if field is ignored for outgoing events
		if ( ignoreType === 'true' || ignoreType === 'out' ) {
			return;
		}

		const currentValue = this.getFieldValue(field);
		const beforeValue = field.getAttribute('data-record-before');

		if ( currentValue === beforeValue ) {
			field.removeAttribute('data-record-dirty');
		} else {
			// Mark field as dirty
			field.setAttribute('data-record-dirty', 'unsent');
		}
		
		// Mark record as dirty
		this.updateRecordDirty(field);

		// Only proceed if value actually changed
		if ( currentValue === beforeValue ) {
			return;
		}
		// Broadcast dirty event
		this.broadcastDirtyEvent(field, beforeValue, currentValue);

		// Handle saving based on mode
		if ( !this.hasSaveButton(field) ) {
			if (
				event.type === 'keydown'
				&&
				event.key === 'Enter'
			) {
				// Immediate mode - save on Enter key
				this.save(field);
			} else if (
				event.type === 'change'
				||
				event.type === 'blur'
			) {
				// Immediate mode - debounced save
				this.debounceSave(field);
			}
		}

	}

	processNewElement(element) {
		// Check if the element itself has data-record-field
		if (element.hasAttribute('data-record-field')) {
			this.initializeField(element);
		}
		
		// Check all descendants for data-record-field
		const fieldElements = element.querySelectorAll('[data-record-field]');
		fieldElements.forEach(field => {
			// Only initialize if not already initialized
			if (!field.hasAttribute('data-record-before')) {
				this.initializeField(field);
			}
		});
	}

	updateRecordDirty(element) {
		const recordElement = this.getRecordElement(element);
		const fields = recordElement.querySelectorAll('[data-record-field]');
		let dirty = '';
		let hasSent = false;
		let hasUnsent = false;

		fields.forEach(field => {
			const fieldDirty = field.getAttribute('data-record-dirty');
			if ( fieldDirty === 'unsent' ) {
				hasUnsent = true;
			} else if ( fieldDirty === 'sent' ) {
				hasSent = true;
			}
		});

		if ( hasUnsent ) {
			dirty = 'unsent';
		} else if ( hasSent ) {
			dirty = 'sent';
		} else {
			dirty = '';
		}

		if ( dirty ) {
			recordElement.setAttribute('data-record-dirty', dirty);
		} else {
			recordElement.removeAttribute('data-record-dirty');
		}
	}

	hasSaveButton(element) {
		const recordElement = this.getRecordElement(element);

		if ( recordElement.querySelector('[data-action*="record#save"]') ) {
			return true;
		}

		if ( recordElement.querySelector('[data-action*="record#saveRecord"]') ) {
			return true;
		}

		return false;
	}

	debounceSave(triggerField) {
		const recordId = this.getRecordId(triggerField);
		const debounceKey = `${this.getTable(triggerField)}-${recordId}`;
		
		// Clear existing timeout
		if ( this.debounceTimeouts.has(debounceKey) ) {
			clearTimeout(this.debounceTimeouts.get(debounceKey));
		}
		
		// Set new timeout
		const timeout = setTimeout(() => {
			this.save(triggerField);
			this.debounceTimeouts.delete(debounceKey);
		}, this.getDebounceTime());
		
		this.debounceTimeouts.set(debounceKey, timeout);
		
	}

	getDebounceTime() {
		// Look for data-record-debounce in ancestors within this controller
		let element = this.element;
		let debounce = this.getAttributeElementValue('data-record-debounce', element);

		if ( debounce ) {
			return parseInt(debounce, 10);
		}

		return 300; // Default debounce time
	}

	getFieldValue(field) {
		
		// Value hierarchy: data-record-value, data-value, value, textContent
		if ( field.hasAttribute('data-record-value') ) {
			return field.getAttribute('data-record-value');
		}
		if ( field.hasAttribute('data-value') ) {
			return field.getAttribute('data-value');
		}
		if ( 'value' in field ) {
			return field.value;
		}

		return field.textContent.trim();
	}

	getFilterValue(filterElement) {
		// If the filter references a record ID from an ancestor table, use that ID
		if ( filterElement.hasAttribute('data-record-idtable') ) {
			const recordAncestor = this.findMatchingRecordAncestor(filterElement);
			console.log('Found ancestor for filter:', recordAncestor);
			if ( recordAncestor ) {
				return recordAncestor.getAttribute('data-record-id') || '';
			}
			// No matching ancestor found → empty string
			return '';
		}

		// Otherwise use the standard field value resolution
		return this.getFieldValue(filterElement);
	}

	setFieldValue(field, value) {
		
		// Set value using the same hierarchy
		if ( field.hasAttribute('data-record-value') ) {
			field.setAttribute('data-record-value', value);
		} else if ( field.hasAttribute('data-value') ) {
			field.setAttribute('data-value', value);
		} else if ( 'value' in field ) {
			field.value = value;
		} else {
			field.textContent = value;
		}

	}

	getAttributeElement(attributeName, element = null) {
		// Find closest parent with the specified attribute
		let elem = element || this.element;
		while ( elem && elem !== this.element ) {
			if ( elem.hasAttribute(attributeName) ) {
				return elem;
			}
			elem = elem.parentElement;
		}
		return this.element;
	}

	getAttributeElementValue(attributeName, element = null) {
		const attrElement = this.getAttributeElement(attributeName, element);
		return attrElement.getAttribute(attributeName) || '';
	}

	getRecordElement(field) {
		// Find closest parent with data-record-id
		return this.getAttributeElement('data-record-id', field);
	}

	getChannel() {
		return this.element.getAttribute('data-record-channel');
	}

	getTable(element = null) {

		return this.getAttributeElementValue('data-record-table', element || this.element);
	}

	getTableElement(element) {

		return this.getAttributeElement('data-record-table', element);
	}

	getTableElementByName(tableName) {
		if ( !tableName ) return null;
		// Check controller root first
		if ( this.element.getAttribute('data-record-table') === tableName ) return this.element;
		// Then search descendants
		const candidates = Array.from(this.element.querySelectorAll('[data-record-table]'));
		for ( const cand of candidates ) {
			if ( cand.getAttribute('data-record-table') === tableName ) return cand;
		}
		return null;
	}

	getRecordId(element) {

		return this.getAttributeElementValue('data-record-id', element);
	}

	getAllFields() {
		return this.element.querySelectorAll('[data-record-field]');
	}

	getFields(element = null) {
		const recordElement = this.getRecordElement(element || this.element);
		let fields = recordElement.querySelectorAll('[data-record-field]');

		// Limit to fields that are not ignored and that belong to the same
		// [data-record-table] scope as the recordElement. This prevents fields
		// from nested/adjacent tables from leaking into this record's field list.
		const tableElement = this.getTableElement(recordElement);

		fields = Array.from(fields).filter(field => {
			return this.getTableElement(field) === tableElement;
		});

		return fields;
	}

	getRecordData(element = null) {
		const channel = this.getChannel();
		const table = this.getTable(element);
		const tableElement = this.getTableElement(element);
		const recordElement = this.getRecordElement(element || this.element);
		const defaults = this.parseDefaults(recordElement);
		const fields = this.getFields(recordElement);
		const filters = this.getTopLevelMatches(tableElement, '[data-record-filter]', '[data-record-table]');
		const record = {};
		const form = {};

		Object.assign(
			record,
			this.getTableFilters(tableElement)
		);

		filters.forEach(filterElement => {
			const fieldName = filterElement.getAttribute('data-record-filter');
			form[fieldName] = this.getFilterValue(filterElement);
		});

		fields.forEach(field => {
			const fieldName = field.getAttribute('data-record-field');
			const ignoreType = field.getAttribute('data-record-ignore');
			
			// Include in record unless ignored completely or for input
			if ( ignoreType !== 'true' && ignoreType !== 'in' ) {
				record[fieldName] = this.getFieldValue(field);
			}
		});

	    // First apply any defaults for fields that don't exist in the DOM
		if ( defaults ) {
			Object.entries(defaults).forEach(([fieldName, value]) => {
				if ( !record[fieldName] ) {
					record[fieldName] = value;
				}
			});
		}

		// Collect form fields
		const formFields = recordElement.querySelectorAll('input, select, textarea');
		formFields.forEach(field => {
			if ( field.name ) {
				form[field.name] = field.value;
			}
		});

		// Dispatch event allowing external code to augment data
		const event = new CustomEvent('record:gather-data', {
			detail: { channel, table, record, form, element: recordElement },
			cancelable: false,
			bubbles: true
		});
		recordElement.dispatchEvent(event);

		return { record, form };
	}

	// Helper to find top-level matches for a selector within a scope, ignoring nested matches
	getTopLevelMatches(scope, selector, parentselector=selector) {
		// If the provided scope itself matches the selector, treat it as the sole top-level match
		if ( scope instanceof Element && scope.matches(selector) ) {
			return [scope];
		}
		const all = Array.from(scope.querySelectorAll(selector));

		return all.filter(el => {
			let parent = el.parentElement;

			// Walk up until scope, checking for same selector match
			while ( parent && parent !== scope ) {
				if ( parent.matches(parentselector) ) return false; // parent is also a match → not top-level
				parent = parent.parentElement;
			}

			return true;
		});
	}

	requestInitialLoad(element=this.element) {
		// Otherwise treat element as a scope and find top-level tables under it
		const tables = this.getTopLevelMatches(element, '[data-record-table]');

		tables.forEach(table => {
			this.runTableElementQuery(table);
		});
	}
    
	isAutoloadEnabledForElement(element) {
        // direct on element
        if ( element && element.getAttribute && element.getAttribute('data-record-autoload') === 'true' ) return true;
        // on table ancestor
        const tableElement = this.getTableElement(element);
        if ( tableElement && tableElement.getAttribute('data-record-autoload') === 'true' ) return true;
        // controller root
        if ( this.element.getAttribute('data-record-autoload') === 'true' ) return true;
        return false;
    }

	runTableElementQuery(tableElement) {
		const filter = this.getLoadFilter(tableElement);
		this.dispatch('query', {
			detail: {
				channel: this.getChannel(),
				table: this.getTable(tableElement),
				filter,
				origin: tableElement
			},
			prefix: 'record:ui'
		});
	}

	// New helper to request a single-record load (keeps connect small)
	requestRecordLoad(recordElement) {
		const id = recordElement.getAttribute('data-record-id');
		if ( !id ) return;
		this.dispatch('load', {
			detail: {
				channel: this.getChannel(),
				table: this.getTable(recordElement),
				id,
				origin: recordElement
			},
			prefix: 'record:ui'
		});
	}

	runAutoLoads() {
		const autos = this.getTopLevelMatches(this.element, '[data-record-autoload="true"]', '[data-record-table]');

		autos.forEach(elem => {
			if (
				this.element.hasAttribute('data-record-table')
				||
				this.element.querySelector('[data-record-id]') !== null
			) {
				// reuse canonical bulk load
				this.requestInitialLoad(elem);
			}
		});

	}

	getTableElements(element = null, root = this.element) {
		const elem = element || this.element;
		const tables = elem.querySelectorAll('[data-record-table]');
		return Array.from(tables).filter(table => {
			return table.closest('[data-record-table]') === root;
		});
	}

	getLoadFilter(element = null) {
		const elem = element || this.element;
		const tableElement = this.getTableElement(elem);
		const filterAttr = (tableElement).getAttribute('data-record-filter');
		let filter = {};

		if ( filterAttr ) {
			try {
				filter = JSON.parse(filterAttr);
			} catch (error) {
				console.warn('Invalid data-record-filter JSON:', filterAttr, error);
			}
		}

		Object.assign(
			filter,
			this.getTableFilters(elem)
		);

		return filter;
	}

	getTableFilters(element = this.element) {
		const tableElement = this.getTableElement(element);
		const filters = this.getTopLevelMatches(tableElement, '[data-record-filter]', '[data-record-table]');
		const filter = {};

		filters.forEach(filterElement => {
			const filterName = filterElement.getAttribute('data-record-filter');
			filter[filterName] = this.getFilterValue(filterElement);
		});

		return filter;
	}

	findMatchingRecordAncestor(filterElement) {
		const targetTable = filterElement.getAttribute('data-record-idtable');
		if (!targetTable) return null;

		let el = filterElement;

		while ( el ) {
			// Stop before going above rootElement
			if ( el === this.element.parentElement ) break;

			if ( el.hasAttribute('data-record-id') ) {
				const tableAncestor = el.closest('[data-record-table]');
				if (
					tableAncestor
					&&
					tableAncestor.getAttribute('data-record-table') === targetTable
				) {
					return el;
				}
			}

			el = el.parentElement;
		}

		return null;
	}

	broadcastDirtyEvent(field, beforeValue, afterValue) {
		let detail = this.getEventDetail(field);

		detail.field = field.getAttribute('data-record-field');
		detail.before = beforeValue;
		detail.after = afterValue;

		this.dispatch('dirty', { 
			detail,
			prefix: 'record:ui'
		});
	}

	broadcastSortEvent(element = null) {
		const tableElement = this.getTableElement(element);
		let detail = this.getEventDetail(element || this.element);
		
		detail.table = this.getTable(element);
		detail.order = this.getRecordOrder(tableElement);

		this.dispatch('sort', {
			detail,
			prefix: 'record:ui'
		});
	}

	broadcastUpdateEvent(recordElement = null) {
		const element = recordElement || this.element;
		const { record, form } = this.getRecordData(element);

		let detail = this.getEventDetail(element);
		detail.record = record;
		detail.form = form;
		
		this.dispatch('update', {
			detail,
			prefix: 'record:ui'
		});
	}

	broadcastAddEvent(recordElement = null) {
		const element = recordElement || this.element;
		const { record, form } = this.getRecordData(element);

		let detail = this.getEventDetail(element);
		detail.record = record;
		detail.form = form;

		this.dispatch('add', {
			detail,
			prefix: 'record:ui'
		});

	}

	broadcastDeleteEvent(element = null) {
		const triggerElement = element || this.getAllFields()[0] || this.element;
		const detail = this.getEventDetail(triggerElement);

		this.dispatch('delete', {
			detail,
			prefix: 'record:ui'
		});
	}

	getEventDetail(element = null) {
		let detail = {channel: this.getChannel()};

		if ( element ) {

			detail.table = this.getTable(element);
			detail.id = this.getRecordId(element);
			detail.element = element;

		}

		return detail;
	}

	getRecordOrder(element = null) {
		// Use provided element or default to controller's element
		const sourceElement = element || this.element;
		
		// Get the table element using existing method
		const tableElement = this.getTableElement(sourceElement);
		
		// If no table element found, return empty array
		if ( !tableElement ) {
			return [];
		}
		
		// Get all direct children with data-record-id attributes
		const recordElements = Array.from(tableElement.children).filter(child => {
			return child.hasAttribute('data-record-id');
		});
		
		// Extract record IDs, filtering out empty values
		const recordIds = recordElements
			.map(element => element.getAttribute('data-record-id'))
			.filter(id => id !== null && id !== '');
		
		return recordIds;
	}

	reportValidityForRecord(recordElement) {
		const candidates = recordElement.querySelectorAll("input, select, textarea");
		
		for ( const elem of candidates ) {
			if ( elem.willValidate && !elem.checkValidity() ) {
				elem.reportValidity();
				return false;
			}
		}

		return true;
	}

	save(element = null) {
		// If no element provided, try to use the first field or the controller element
		const triggerElement = element || this.getAllFields()[0] || this.element;
		const recordElement = this.getRecordElement(triggerElement);
		const recordId = this.getRecordId(triggerElement);

		// Validate record before saving
		if ( !this.reportValidityForRecord(recordElement) ) return;
		
		// Mark as sent
		recordElement.setAttribute('data-record-dirty', 'sent');
		const fields = recordElement.querySelectorAll('[data-record-field]');
		fields.forEach(field => {
			if ( field.getAttribute('data-record-dirty') === 'unsent' ) {
				field.setAttribute('data-record-dirty', 'sent');
			}
		});

		if ( !recordId ) {
			// This is a new record
			this.broadcastAddEvent(recordElement);
		} else {
			// This is an update
			this.broadcastUpdateEvent(recordElement);
		}

	}

	// Stimulus action method for save button
	saveRecord(event) {
		// When called from data-action, event.target is the button that was clicked
		const button = event.target;

		event.preventDefault();

		this.save(button);
	}

	cancel(scope=this.element) {
		// Reset all dirty fields back to their original values
		if ( Array.isArray(scope) ) {
			scope.forEach(element => {
				this.resetElement(element);
			});
		} else if ( scope instanceof Element ) {
			this.resetElement(scope);
		} else {
			throw new Error('Scope must be either an array of DOM elements or a single DOM element');
		}
	}

	cancelRecord( event ) {
		const recordElement = this.getRecordElement(event.target);
		this.resetElement( recordElement );
		
	}

	resetElement( element = null ) {
		const fields = element.querySelectorAll('[data-record-field]');
		
		fields.forEach(field => {
			const beforeValue = field.getAttribute('data-record-before');
			this.setFieldValue(field, beforeValue);
			field.removeAttribute('data-record-dirty');
		});
		
		element.removeAttribute('data-record-dirty');
	}

	delete( element = null ) {
		const recordElement = this.getRecordElement(element);

		this.broadcastDeleteEvent(element);

		recordElement.remove();

	}

	deleteRecord( event ) {
		
		this.delete(event.target);
		
	}

	// Event listeners for data events
	setupEventListeners() {
		this.boundUpdateHandler = this.handleDataUpdate.bind(this);
		this.boundAddHandler = this.handleDataAdd.bind(this);
		this.boundDeleteHandler = this.handleDataDelete.bind(this);
		this.boundLoadHandler = this.handleDataLoad.bind(this);

		document.addEventListener('record:data:update', this.boundUpdateHandler);
		document.addEventListener('record:data:add', this.boundAddHandler);
		document.addEventListener('record:data:delete', this.boundDeleteHandler);
		document.addEventListener('record:data:load', this.boundLoadHandler);

		// Set up sort event listener if configured
		if ( this.element.getAttribute('data-record-sort-detection') === 'event' ) {
			document.addEventListener('record:ui:sorted', this.handleSortComplete.bind(this));
		}

	}

	removeEventListeners() {
		if ( this.boundUpdateHandler ) {
			document.removeEventListener('record:data:update', this.boundUpdateHandler);
		}
		if ( this.boundAddHandler ) {
			document.removeEventListener('record:data:add', this.boundAddHandler);
		}
		if ( this.boundDeleteHandler ) {
			document.removeEventListener('record:data:delete', this.boundDeleteHandler);
		}
		if ( this.boundLoadHandler ) {
			document.removeEventListener('record:data:load', this.boundLoadHandler);
		}
	}

	handleDataUpdate(event) {
		const { table, id, record } = event.detail;

		let targetElement;
		if ( this.element.getAttribute('data-record-addmissing') === 'true' ) {
			targetElement = this.findOrCreateRecordElement(table, id, record);
		} else {
			targetElement = this.findRecordElement(table, id);
		}
		if ( !targetElement ) return;

		this.updateRecordFromData(targetElement, record);
	}

	handleDataAdd(event) {
		const { table, id, record } = event.detail;

		const targetElement = this.findOrCreateRecordElement(table, id, record);

		if ( targetElement ) {
			this.updateRecordFromData(targetElement, record);
			//this.ensureAddRecord();
		}
	}

	handleDataDelete(event) {
		const { table, id } = event.detail;
		
		const targetElement = this.findRecordElement(table, id);
		if ( targetElement ) {
			targetElement.remove();
		}
	}

	handleDataLoad(event) {
		const { channel, table, records, record, origin } = event.detail;
		let tableElement = null;

		// Only handle if this is our channel
		if ( channel && channel !== this.getChannel() ) return;

		if ( origin ) {
			if ( this.element.contains(origin) ) {
				tableElement = origin;
			} else {
				return;
			}
		} else {
			const tableElements = this.element.querySelectorAll(`[data-record-table="${table}"]`);
			if ( tableElements.length === 1 ) {
				tableElement = tableElements[0];
			} else {
				// Ambiguous or missing origin - skip processing
				return;
			}
		}
		
		// Priority 1: Array of records (bulk load, including empty arrays)
		if ( records && Array.isArray(records) ) {
			// Expect items to be normalized as { id, record } by the source (e.g. recordcfc)
			// But accept legacy arrays of raw record objects and normalize them here.
			const recordArray = records.map(item => {
				if ( item && typeof item === 'object' && ('id' in item) && ('record' in item) ) {
					return item; // already normalized
				}
				// legacy raw record object -> wrap
				return { id: item && item.id ? item.id : '', record: item };
			});

			// Use load() method which handles add row positioning
			this.load(recordArray, true, tableElement);

			return;
		}
		
		// Priority 2: Single record (fallback)
		if ( record && typeof record === 'object' ) {
			const tableEl = this.getTableElementByName(table) || this.element;
			this.insertRecordElement(tableEl, record, record.id || '', null);
			
			this.dispatch('loaded', {
				detail: { channel, table, id: record.id },
				prefix: 'record:ui'
			});
			
			return;
		}
		
		// Log warning if neither format found
		console.warn('record:data:load event had no valid record or records', event.detail);
	}

	findRecordElement(table, id) {
		
		// Check if the controller's root element matches
		if (
			this.element.getAttribute('data-record-table') == table
			&&
			this.element.getAttribute('data-record-id') == id
		) {
			return this.element;
		}
		
		// Find element with matching data-record-id within our table scope
		const candidates = this.element.querySelectorAll(`[data-record-id="${id}"]`);

		for ( const candidate of candidates ) {
			if ( this.getTable(candidate) === table ) {
				return candidate;
			}
		}
		
		return null;
	}

	findOrCreateRecordElement(table, id, record) {
		// First try to find existing element by id
		let targetElement = this.findRecordElement(table, id);
		if ( targetElement ) return targetElement;

		// Try to find by dirty state and matching values
		const sentElements = this.element.querySelectorAll('[data-record-dirty="sent"]');
		
		for ( const element of sentElements ) {
			let recordElementTable = this.getTable(element);
			if ( recordElementTable !== table ) continue;

			if ( this.recordMatches(element, record) ) {
				// Found matching sent element - just update its ID, don't fire new events
				// The mutation observer will fire record:ui:updated which is fine
				element.setAttribute('data-record-id', id);
				
				return element;
			}
		}

		// Create new element from template and insert into the correct table container
		const tableEl = this.getTableElementByName(table) || this.element;
		targetElement = this.insertRecordElement(tableEl, record, '', null);
		if ( targetElement ) {
			targetElement.setAttribute('data-record-id', id);
		}
		if ( targetElement ) {
			return targetElement;
		}

		return null;
	}

	recordMatches(element, record) {
		const fields = element.querySelectorAll('[data-record-field]');
		
		for ( const field of fields ) {
			const fieldName = field.getAttribute('data-record-field');
			const fieldValue = this.getFieldValue(field);
			
			if ( record[fieldName] !== fieldValue ) {
				return false;
			}
		}
		
		return true;
	}

	shouldMaintainAddRecord(element = null) {
		// Check if the controller (or provided element) should always maintain an empty "Add" record
		const elem = element || this.element;
		const tableElement = this.getTableElement(elem);
		if ( !tableElement ) {
			return false;
		}
		const attr = tableElement.getAttribute('data-record-auto-add');
		return tableElement.hasAttribute('data-record-auto-add')?  attr === 'true' : false;
	}

	updateRecordFromData(targetElement, record) {
		const fields = targetElement.querySelectorAll('[data-record-field]');
		let hasUnsentChanges = false;

		fields.forEach(field => {
			const fieldName = field.getAttribute('data-record-field');
			const ignoreType = field.getAttribute('data-record-ignore');
			
			// Skip if field is ignored for incoming updates
			if ( ignoreType === 'true' || ignoreType === 'in' ) {
				return;
			}
			
			if ( record.hasOwnProperty(fieldName) || record.hasOwnProperty(fieldName.toLowerCase()) ) {
				const newValue = record[fieldName] || record[fieldName.toLowerCase()] || '';
				this.setFieldValue(field, newValue);
				field.setAttribute('data-record-before', newValue);
				
				// Clear dirty state if it was sent
				if ( field.getAttribute('data-record-dirty') === 'sent' ) {
					field.removeAttribute('data-record-dirty');
				} else if ( field.getAttribute('data-record-dirty' ) === 'unsent') {
					hasUnsentChanges = true;
				}
			}
		});

		// Clear record dirty state if no unsent changes remain
		if ( !hasUnsentChanges && targetElement.getAttribute('data-record-dirty') === 'sent' ) {
			targetElement.removeAttribute('data-record-dirty');
		}
	}

	createRecordFromTemplate(element = null,excludeElement = null) {
		const elem = element || this.element;
		const tableElement = this.getTableElement(elem);
		// findTemplate now accepts an element first; use controller root for backward compatibility
		const template = this.findTemplate(tableElement, excludeElement);
		if ( !template ) {
			console.error('No template found for creating new record');
			return null;
		}

		let newElement;
		
		if ( template.tagName === 'TEMPLATE' ) {
			newElement = template.content.cloneNode(true).children[0];
		} else {
			newElement = template.cloneNode(true);
		}

		// Clear any existing data-record-id and set it to empty for new records
		newElement.setAttribute('data-record-id', '');
		
		// Process name and ID attributes for uniqueness
		this.processNameAndIdAttributes(newElement, '');
		
		// Initialize fields in new element
		const fields = newElement.querySelectorAll('[data-record-field]');
		fields.forEach(field => this.initializeField(field));

		// Apply default values from data-record-defaults
		this.applyDefaults(newElement);

		return newElement;
	}

	applyDefaults(element) {
		const defaults = this.parseDefaults(element);

		if ( !defaults ) {
			return;
		}
		
		Object.entries(defaults).forEach(([fieldName, value]) => {
			const field = element.querySelector(`[data-record-field="${fieldName}"]`);
			if ( field && this.getFieldValue(field) === '' ) {
				this.setFieldValue(field, value);
				field.setAttribute('data-record-before', value);
			}
		});
	}

	findTemplate(element = null, excludeElement = null) {
		// Priority: data-record-template selector, direct template child, empty record element
		const elem = element || this.element;
		const tableElement = this.getTableElement(elem);

		const templateSelector = tableElement.getAttribute('data-record-template');
		if ( templateSelector ) {
			return document.querySelector(templateSelector);
		}

		// Look for direct template child
		const directTemplate = tableElement.querySelector(':scope > template');
		if ( directTemplate ) {
			return directTemplate;
		}

		// Look for element with empty data-record-id (but not the excluded one)
		//const emptyRecords = tableElement.querySelectorAll('[data-record-id=""]');
		const emptyRecords = this.getTopLevelMatches(tableElement, '[data-record-id=""]', '[data-record-table]');
		for ( const emptyRecord of emptyRecords ) {
			if ( emptyRecord !== excludeElement ) {
				return emptyRecord;
			}
		}

		const firstRecord = tableElement.querySelector('[data-record-id]');
		if ( firstRecord ) {
			const recordElement = firstRecord.cloneNode(true);
			recordElement.setAttribute('data-record-id', '');

			const fields = recordElement.querySelectorAll('[data-record-field]');
			fields.forEach(field => {
				field.removeAttribute('data-record-before');
				this.setFieldValue(field, '');
				this.initializeField(field);
			});

			return recordElement;
		}

		return null;
	}

	insertRecordElement(element = null, recordData = null, id = '', excludeElement = null) {
		// element: element (or descendant) used to determine the table scope to insert into
		const elem = element || this.element;

		const newElement = this.createRecordFromTemplate(elem, excludeElement);

		if ( !newElement ) return;

		// Determine the table element for the provided element (falls back to controller root)
		const tableElement = this.getTableElement(elem) || this.element;
		const position = tableElement.getAttribute('data-record-add-position') || 'after';
		let referenceRecord = tableElement.querySelector('[data-record-id=""]');

		if ( recordData && typeof recordData === 'object' ) {
			Object.entries(recordData).forEach(([fieldName, value]) => {
				const field = newElement.querySelector(`[data-record-field="${fieldName}" i]`);
				if ( field ) {
					this.setFieldValue(field, value);
					field.setAttribute('data-record-before', value);
				}
			});
		}

		newElement.setAttribute('data-record-id', id);

		// Process name and ID attributes when record gets an actual ID
		if ( id ) {
			this.processNameAndIdAttributes(newElement, id);
		}

		// If no empty record found, determine reference record based on position
		if ( !referenceRecord ) {
			let recordElements = tableElement.querySelectorAll('[data-record-id]');
			if ( recordElements && recordElements.length ) {
				if ( position === 'before' ) {
					referenceRecord = recordElements[0];
				} else {
					referenceRecord = recordElements[recordElements.length - 1];
				}
			} else {
				// No existing records, append to end
				tableElement.appendChild(newElement);
				return newElement;
			}
		}

		if ( !referenceRecord ) {
			// No reference record found, append to end
			tableElement.appendChild(newElement);
		} else {
			if ( position === 'before' ) {
				referenceRecord.parentNode.insertBefore(newElement, referenceRecord);
			} else {
				referenceRecord.parentNode.insertBefore(newElement, referenceRecord.nextSibling);
			}
		}

		const detail = this.getEventDetail(newElement);
		
		// Only fire 'added' event if this is a real record with an ID or data
		// Don't fire for empty "add" records (id="" and no field values)
		if ( id || this.hasFieldValues(newElement) ) {
			this.dispatch('added', { 
				detail,
				prefix: 'record:ui'
			});
		}
		
		return newElement;
	}

	hasFieldValues(element) {
		// Check if any fields have non-empty values
		const fields = element.querySelectorAll('[data-record-field]');
		for ( const field of fields ) {
			const value = this.getFieldValue(field);
			if ( value && value.trim() !== '' ) {
				return true;
			}
		}
		return false;
	}

	insertRecordElements(element = null, array = []) {
		array.forEach(item => {
			this.insertRecordElement(element, item.record, item.id, null);
		});
	}

	load(array = [], clearExisting = true, element = null) {
		element = element || this.element;
		const emptyRecord = element.querySelector('[data-record-id=""]');
		if ( clearExisting ) {
			element.querySelectorAll('[data-record-id]').forEach(element => {
				if ( element !== emptyRecord ) {
					element.remove();
				}
			});
		}
		if ( emptyRecord ) {
			const position = this.element.getAttribute('data-record-add-position') || 'after';
			const item = { record: {}, id: '' };
			if ( position === 'before' ) {
				array.unshift(item);
			} else {
				array.push(item);
			}
		}
		
		// First, update existing records
		array.forEach((item, idx) => {
			if ( !item.id ) return; // Skip new records

			//const recordElement = element.getAttribute('data-record-id') === item.id ? element : element.querySelector(`[data-record-id="${item.id}"]`);
			const recordElement = this.findRecordElement(this.getTable(element), item.id);
			if ( recordElement ) {
				// Existing record found, update it
				this.updateRecordFromData(recordElement, item.record);
			}
		});

		// Determine container for insertion: keep default controller element
		this.insertRecordElements(element, array.reverse());

		if ( emptyRecord ) {
			emptyRecord.remove();
		}

		const detail = this.getEventDetail();
		detail.count = array.length - (emptyRecord ? 1 : 0); // Don't count the add row

		// Dispatch loaded event
		this.dispatch('loaded', {
			detail: detail,
			prefix: 'record:ui'
		});

	}

	// Helper methods for name and ID processing
	deriveIdFromName(nameValue, idValue) {
		if ( !nameValue || !idValue ) return null;
		
		// Case 1: ID starts with name ("bob" -> "bob-verse")
		if ( idValue.startsWith(nameValue) ) {
			return idValue.substring(nameValue.length); // Returns "-verse"
		}
		
		// Case 2: ID ends with name ("prefix-bob" -> name is "bob")
		if ( idValue.endsWith(nameValue) ) {
			return idValue.substring(0, idValue.length - nameValue.length); // Returns "prefix-"
		}
		
		// Case 3: Name is contained within ID ("some-bob-thing" -> name is "bob")
		const nameIndex = idValue.indexOf(nameValue);
		if ( nameIndex !== -1 ) {
			const prefix = idValue.substring(0, nameIndex);
			const suffix = idValue.substring(nameIndex + nameValue.length);
			return { prefix, suffix }; // More complex case
		}
		
		return null; // No clear relationship
	}

	getRecordNumber(recordId) {
		// Calculate the sequential number of this record within the table
		const allRecords = this.element.querySelectorAll('[data-record-id]');
		let count = 0;
		
		for ( const record of allRecords ) {
			const currentId = record.getAttribute('data-record-id');
			if ( currentId !== '' ) {
				count++;
				if ( currentId === recordId ) {
					return count;
				}
			}
		}
		
		// For new records (empty ID), return the next number
		return count + 1;
	}

	updateLabelsForId(element, oldId, newId) {
		const labels = element.querySelectorAll(`label[for="${oldId}"]`);
		labels.forEach(label => label.setAttribute('for', newId));
	}

	processNameAndIdAttributes(element, recordId) {
		const namePattern = this.element.getAttribute('data-record-names');
		const idPattern = this.element.getAttribute('data-record-ids');
		
		if ( !namePattern && !idPattern ) return;
		
		const recordNum = this.getRecordNumber(recordId);
		const nameFields = element.querySelectorAll('[name]');
		
		nameFields.forEach(field => {
			const originalName = field.getAttribute('name');
			const originalId = field.getAttribute('id');
			
			let newName = originalName;
			let newId = originalId;
			
			// Process name if pattern exists
			if ( namePattern ) {
				newName = namePattern
					.replace(/\[name\]/g, originalName)
					.replace(/\[id\]/g, recordId)
					.replace(/\[record-id\]/g, recordId)
					.replace(/\[num\]/g, recordNum);
				field.setAttribute('name', newName);
			}
			
			// Process ID
			if ( originalId ) {
				if ( idPattern ) {
					// Explicit ID pattern provided
					newId = idPattern
						.replace(/\[name\]/g, originalName)
						.replace(/\[id\]/g, recordId)
						.replace(/\[record-id\]/g, recordId) 
						.replace(/\[num\]/g, recordNum);
				} else if ( namePattern ) {
					// Auto-detect ID relationship to name
					const relationship = this.deriveIdFromName(originalName, originalId);
					if ( relationship ) {
						if ( typeof relationship === 'string' ) {
							// Simple suffix/prefix case
							newId = newName + relationship;
						} else if ( relationship.prefix !== undefined ) {
							// Complex case with prefix and suffix
							newId = relationship.prefix + newName + relationship.suffix;
						}
					}
				}

				if ( newId !== originalId ) {
					field.setAttribute('id', newId);
					this.updateLabelsForId(element, originalId, newId);
				}
			}
		});
		
		// Also process elements that have ID but no name attribute
		if ( idPattern ) {
			const idOnlyElements = element.querySelectorAll('[id]:not([name])');
			idOnlyElements.forEach(field => {
				const originalId = field.getAttribute('id');
				const newId = idPattern
					.replace(/\[name\]/g, '') // No name to substitute
					.replace(/\[id\]/g, recordId)
					.replace(/\[record-id\]/g, recordId)
					.replace(/\[num\]/g, recordNum);
				
				if ( newId !== originalId ) {
					field.setAttribute('id', newId);
					this.updateLabelsForId(element, originalId, newId);
				}
			});
		}
	}

	// Action methods that can be called from markup
	saveAction(event) {
		event.preventDefault();
		this.save(event.target);
	}

	deleteAction(event) {
		event.preventDefault();
		this.delete(event.target);
	}

	addAction(event) {
		event.preventDefault();
		// Insert into the table container nearest the controller root by default
		const newElement = this.insertRecordElement(this.element);
		if ( newElement ) {
			// Focus first field in new record
			const firstField = newElement.querySelector('[data-record-field]');
			if ( firstField && firstField.focus ) {
				firstField.focus();
			}
		}
	}

	parseDefaults(element) {
		const defaultsString = this.getAttributeElementValue('data-record-defaults', element);
		let recordDefaults = {};
		
		if ( defaultsString ) {
			const params = new URLSearchParams(defaultsString);
			for ( const [key, value] of params ) {
				recordDefaults[key] = value;
			}
		}

		return recordDefaults;
	}

});

