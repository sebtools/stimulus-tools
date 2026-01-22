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

		// Request initial data load if configured
		if (this.element.getAttribute('data-record-autoload') === 'true') {
			this.requestInitialLoad();
		}
	}

	disconnect() {
		// Fire event before cleanup so external code can access controller data
		this.dispatch('disconnected', {
			detail: this.getEventDetail(),
			prefix: 'record'
		});

		this.removeEventListeners();

		// Clean up mutation observers
		for ( const observer in this.observers ) {
			this.observers[observer].disconnect();
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
		this.insertRecordElement();
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
		this.observers = {};
		this.setupContainerMutationObserver();
	}
	setupContainerMutationObserver() {
		this.observers.container = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				if (mutation.type === 'childList') {
					// Check added nodes
					mutation.addedNodes.forEach((node) => {
						if (node.nodeType === Node.ELEMENT_NODE) {
							this.processNewElement(node);
						}
					});
				} else if (mutation.type === 'attributes' && mutation.attributeName === 'data-record-id') {
					// Handle data-record-id changes for auto-add functionality
					this.handleRecordIdChange(mutation.target, mutation.oldValue);
				}
			});
		});
		
		this.observers.container.observe(this.element, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['data-record-id'],
			attributeOldValue: true
		});
	}
	
	handleRecordIdChange(element, oldValue) {
		const detail = this.getEventDetail(element);

		// Check if this was an empty record that just got assigned an ID
		if ( oldValue === '' && element.getAttribute('data-record-id') !== '' ) {
			// Ensure there is still an empty record
			this.ensureAddRecord();
		}

		this.dispatch('updated', {
			detail,
			prefix: 'record:ui'
		});

	}

	ensureAddRecord() {
		// Ensure there is always an empty record for adding new entries
		if ( !this.shouldMaintainAddRecord() ) {
			return;
		}
		const emptyRecord = this.element.querySelector('[data-record-id=""]');
		if ( !emptyRecord ) {
			this.insertRecordElement();
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
		while (element) {
			const debounce = element.getAttribute('data-record-debounce');
			if (debounce) {
				return parseInt(debounce, 10);
			}
			element = element.parentElement;
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

	getRecordId(element) {

		return this.getAttributeElementValue('data-record-id', element);
	}

	getAllFields() {
		return this.element.querySelectorAll('[data-record-field]');
	}

	getRecordData(element = null) {
		const channel = this.getChannel();
		const table = this.getTable(element);
		const recordElement = this.getRecordElement(element || this.element);
		const defaults = this.parseDefaults(recordElement);
		const fields = recordElement.querySelectorAll('[data-record-field]');
		const record = {};
		const form = {};

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

	// ToDo: Need to load each table in the controller separately
	requestInitialLoad() {
		const table = this.getTable();
		const filter = this.getLoadFilter();
		
		this.dispatch('query', {
			detail: { table, filter },
			prefix: 'record:ui'
		});
	}

	getLoadFilter() {
		const filterAttr = this.element.getAttribute('data-record-filter');
		if (!filterAttr) return {};
		
		try {
			return JSON.parse(filterAttr);
		} catch (error) {
			console.warn('Invalid data-record-filter JSON:', filterAttr, error);
			return {};
		}
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

	save(element = null) {
		// If no element provided, try to use the first field or the controller element
		const triggerElement = element || this.getAllFields()[0] || this.element;
		const recordElement = this.getRecordElement(triggerElement);
		const recordId = this.getRecordId(triggerElement);
		
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
		if (!targetElement) return;

		this.updateRecordFromData(targetElement, record);
	}

	handleDataAdd(event) {
		const { table, id, record } = event.detail;

		const targetElement = this.findOrCreateRecordElement(table, id, record);
		if (targetElement) {
			this.updateRecordFromData(targetElement, record);
		}
	}

	handleDataDelete(event) {
		const { table, id } = event.detail;
		
		const targetElement = this.findRecordElement(table, id);
		if (targetElement) {
			targetElement.remove();
		}
	}

	handleDataLoad(event) {
		const { channel, table, records, record } = event.detail;

		// Only handle if this is our channel
		if (channel && channel !== this.getChannel()) return;
		
		// Only handle if this is our table
		if (table !== this.getTable()) return;
		
		// Priority 1: Array of records (bulk load, including empty arrays)
		if (records && Array.isArray(records)) {
			const recordArray = records.map(rec => ({
				id: rec.id || '',
				record: rec
			}));
			
			// Use load() method which handles add row positioning
			this.load(recordArray, true);
			
			return;
		}
		
		// Priority 2: Single record (fallback)
		if ( record && typeof record === 'object' ) {
			this.insertRecordElement(record, record.id || '');
			
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

		// Create new element from template
		targetElement = this.insertRecordElement(record);
		targetElement.setAttribute('data-record-id', id);
		if ( targetElement ) {
			return targetElement;
		}

		return null;
	}

	recordMatches(element, record) {
		const fields = element.querySelectorAll('[data-record-field]');
		
		for (const field of fields) {
			const fieldName = field.getAttribute('data-record-field');
			const fieldValue = this.getFieldValue(field);
			
			if (record[fieldName] !== fieldValue) {
				return false;
			}
		}
		
		return true;
	}

	shouldMaintainAddRecord() {
		// Check if the controller should always maintain an empty "Add" record
		const result = this.element.hasAttribute('data-record-auto-add') || 
			   this.element.getAttribute('data-record-auto-add') === 'true';
		return result;
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
			
			if ( record.hasOwnProperty(fieldName) ) {
				const newValue = record[fieldName];
				this.setFieldValue(field, newValue);
				field.setAttribute('data-record-before', newValue);
				
				// Clear dirty state if it was sent
				if (field.getAttribute('data-record-dirty') === 'sent') {
					field.removeAttribute('data-record-dirty');
				} else if (field.getAttribute('data-record-dirty') === 'unsent') {
					hasUnsentChanges = true;
				}
			}
		});

		// Clear record dirty state if no unsent changes remain
		if ( !hasUnsentChanges && targetElement.getAttribute('data-record-dirty') === 'sent' ) {
			targetElement.removeAttribute('data-record-dirty');
		}
	}

	createRecordFromTemplate(excludeElement = null) {
		const template = this.findTemplate(excludeElement);
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

	findTemplate(excludeElement = null) {
		// Priority: data-record-template selector, direct template child, empty record element
		const templateSelector = this.element.getAttribute('data-record-template');
		if (templateSelector) {
			return document.querySelector(templateSelector);
		}

		// Look for direct template child
		const directTemplate = this.element.querySelector(':scope > template');
		if (directTemplate) {
			return directTemplate;
		}

		// Look for element with empty data-record-id (but not the excluded one)
		const emptyRecords = this.element.querySelectorAll('[data-record-id=""]');
		for (const emptyRecord of emptyRecords) {
			if (emptyRecord !== excludeElement) {
				return emptyRecord;
			}
		}

		const recordElement = this.element.querySelector('[data-record-id]').cloneNode(true);
		if ( recordElement ) {
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

	insertRecordElement(recordData = null, id = '', excludeElement = null) {
		const newElement = this.createRecordFromTemplate(excludeElement);

		if ( !newElement ) return;

		const position = this.element.getAttribute('data-record-add-position') || 'after';
		let referenceRecord = this.element.querySelector('[data-record-id=""]');

		if ( recordData && typeof recordData === 'object' ) {
			Object.entries(recordData).forEach(([fieldName, value]) => {
				const field = newElement.querySelector(`[data-record-field="${fieldName}"]`);
				if (field) {
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
			let recordElements = this.element.querySelectorAll('[data-record-id]');
			if ( recordElements ) {
				if ( position === 'before' ) {
					referenceRecord = recordElements[0];
				} else {
					referenceRecord = recordElements[recordElements.length - 1];
				}
			} else {
				// No existing records, append to end
				this.element.appendChild(newElement);
				return newElement;
			}
		}

		if ( !referenceRecord ) {
			// No reference record found, append to end
			this.element.appendChild(newElement);
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
		for (const field of fields) {
			const value = this.getFieldValue(field);
			if (value && value.trim() !== '') {
				return true;
			}
		}
		return false;
	}

	insertRecordElements(array = []) {
		array.forEach(item => {
			this.insertRecordElement(item.record, item.id);
		});
	}

	load(array = [], clearExisting = true) {
		const emptyRecord = this.element.querySelector('[data-record-id=""]');
		if ( clearExisting ) {
			this.element.querySelectorAll('[data-record-id]').forEach(element => {
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

		this.insertRecordElements(array.reverse());

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
		if (!nameValue || !idValue) return null;
		
		// Case 1: ID starts with name ("bob" -> "bob-verse")
		if (idValue.startsWith(nameValue)) {
			return idValue.substring(nameValue.length); // Returns "-verse"
		}
		
		// Case 2: ID ends with name ("prefix-bob" -> name is "bob")
		if (idValue.endsWith(nameValue)) {
			return idValue.substring(0, idValue.length - nameValue.length); // Returns "prefix-"
		}
		
		// Case 3: Name is contained within ID ("some-bob-thing" -> name is "bob")
		const nameIndex = idValue.indexOf(nameValue);
		if (nameIndex !== -1) {
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
		
		for (const record of allRecords) {
			const currentId = record.getAttribute('data-record-id');
			if (currentId !== '') {
				count++;
				if (currentId === recordId) {
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
		
		if (!namePattern && !idPattern) return;
		
		const recordNum = this.getRecordNumber(recordId);
		const nameFields = element.querySelectorAll('[name]');
		
		nameFields.forEach(field => {
			const originalName = field.getAttribute('name');
			const originalId = field.getAttribute('id');
			
			let newName = originalName;
			let newId = originalId;
			
			// Process name if pattern exists
			if (namePattern) {
				newName = namePattern
					.replace(/\[name\]/g, originalName)
					.replace(/\[id\]/g, recordId)
					.replace(/\[record-id\]/g, recordId)
					.replace(/\[num\]/g, recordNum);
				field.setAttribute('name', newName);
			}
			
			// Process ID
			if (originalId) {
				if (idPattern) {
					// Explicit ID pattern provided
					newId = idPattern
						.replace(/\[name\]/g, originalName)
						.replace(/\[id\]/g, recordId)
						.replace(/\[record-id\]/g, recordId) 
						.replace(/\[num\]/g, recordNum);
				} else if (namePattern) {
					// Auto-detect ID relationship to name
					const relationship = this.deriveIdFromName(originalName, originalId);
					if (relationship) {
						if (typeof relationship === 'string') {
							// Simple suffix/prefix case
							newId = newName + relationship;
						} else if (relationship.prefix !== undefined) {
							// Complex case with prefix and suffix
							newId = relationship.prefix + newName + relationship.suffix;
						}
					}
				}
				
				if (newId !== originalId) {
					field.setAttribute('id', newId);
					this.updateLabelsForId(element, originalId, newId);
				}
			}
		});
		
		// Also process elements that have ID but no name attribute
		if (idPattern) {
			const idOnlyElements = element.querySelectorAll('[id]:not([name])');
			idOnlyElements.forEach(field => {
				const originalId = field.getAttribute('id');
				const newId = idPattern
					.replace(/\[name\]/g, '') // No name to substitute
					.replace(/\[id\]/g, recordId)
					.replace(/\[record-id\]/g, recordId)
					.replace(/\[num\]/g, recordNum);
				
				if (newId !== originalId) {
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
		const newElement = this.insertRecordElement();
		if ( newElement ) {
			// Focus first field in new record
			const firstField = newElement.querySelector('[data-record-field]');
			if (firstField && firstField.focus) {
				firstField.focus();
			}
		}
	}

	parseDefaults(element) {
		const defaultsString = this.getAttributeElementValue('data-record-defaults', element);
		let recordDefaults = {};
		
		if (defaultsString) {
			const params = new URLSearchParams(defaultsString);
			for ( const [key, value] of params ) {
				recordDefaults[key] = value;
			}
		}

		return recordDefaults;
	}

});

