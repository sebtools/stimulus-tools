application.register('recordcfc', class extends Stimulus.Controller {
	static values = {
		idarg: String     // data-recordcfc-idarg-value - CFC parameter name for ID
	}

	connect() {
		// Validate required controllers exist on the same element
		this.recordController = this.application.getControllerForElementAndIdentifier(
			this.element,
			'record'
		);
		this.cfcController = this.application.getControllerForElementAndIdentifier(
			this.element,
			'cfc'
		);
		
		if ( !this.recordController ) {
			throw new Error('RecordCFC controller requires a "record" controller on the same element');
		}
		if ( !this.cfcController ) {
			throw new Error('RecordCFC controller requires a "cfc" controller on the same element');
		}
		
		// Unless specified, do not use busy indicator from CFC controller
		// That will allow this controller to manage it in a more granular way
		if ( !this.element.hasAttribute('data-cfc-usebusy') ) {
			this.element.setAttribute('data-cfc-usebusy', 'false');
		}
		
		// Set up event listeners for record UI events
		this.setupEventListeners();
		
	}

	disconnect() {
		this.removeEventListeners();
	}

	setupEventListeners() {
		// Bind handlers to maintain 'this' context
		this.boundHandleAdd = this.handleAdd.bind(this);
		this.boundHandleUpdate = this.handleUpdate.bind(this);
		this.boundHandleDelete = this.handleDelete.bind(this);
		this.boundHandleCFC = this.handleCFC.bind(this);

		// Listen for record UI events
		document.addEventListener('record:ui:add', this.boundHandleAdd);
		document.addEventListener('record:ui:update', this.boundHandleUpdate);
		document.addEventListener('record:ui:delete', this.boundHandleDelete);
		
		// Listen for load/query requests
		this.boundHandleQuery = this.handleQuery.bind(this);
		document.addEventListener('record:ui:query', this.boundHandleQuery);

		// Listen for CFC events
		document.addEventListener('cfc:called', this.boundHandleCFC);

	}

	removeEventListeners() {
		if ( this.boundHandleAdd ) {
			document.removeEventListener('record:ui:add', this.boundHandleAdd);
		}
		if ( this.boundHandleUpdate ) {
			document.removeEventListener('record:ui:update', this.boundHandleUpdate);
		}
		if ( this.boundHandleDelete ) {
			document.removeEventListener('record:ui:delete', this.boundHandleDelete);
		}
		if ( this.boundHandleQuery ) {
			document.removeEventListener('record:ui:query', this.boundHandleQuery);
		}
		if ( this.boundHandleCFC ) {
			document.removeEventListener('cfc:called', this.boundHandleCFC);
		}
	}

	getIdArgName(element) {
		const attName = `data-recordcfc-idarg`;
		const argElement = this.recordController.getAttributeElement(attName, element);
		const result = argElement ? argElement.getAttribute(attName) : null;
		
		if ( !result ) {
			throw new Error(`No idarg configured. Set data-recordcfc-idarg.`);
		}
		
		return result;	
	}

	getMethodElement(element, action) {
		const attName = `data-recordcfc-method-${action}`;
		return this.recordController.getAttributeElement(attName, element);
	}

	getMethodName(element, action) {
		const methodElement = this.getMethodElement(element, action);
		const attName = `data-recordcfc-method-${action}`;
		const methodName = methodElement ? methodElement.getAttribute(attName) : null;
		
		if ( !methodName ) {
			throw new Error(`No ${action} method configured. Set data-recordcfc-method-${action}.`);
		}
		return methodName;
	}

	// Indicate busy state similar to other controllers
	busy(isBusy, element=this.element) {
		const recordElement = this.recordController.getAttributeElement('data-record-id', element);
		const elem = recordElement || element;

		console.log(`RecordCFC busy(${isBusy}) on element:`, elem);

		// Add or remove identifier from busywith attribute to indicate that the element is busy with this controller
		if ( isBusy ) {
			elem.dataset.busywith = (elem.dataset.busywith || '') + ' ' + this.identifier;
		} else {
			elem.dataset.busywith = (elem.dataset.busywith || '').replace(this.identifier, '').trim();
		}

		// Set aria-busy attribute to indicate that the element is doing anything
		//elem.ariaBusy = ( elem.dataset.busywith.length > 0 );

	}

	// Handle cfc:called events
	async handleCFC(event) {

		if ( event.channel && event.channel !== this.cfcController.getChannel() ) {
			return; // Not our event, ignore it
		}

		if ( event.method && event.method === this.element.getAttribute('data-recordcfc-method-save') ) {
			// This was a save call, handle post-save logic here
			document.dispatchEvent(new CustomEvent('record:data:update', {
				detail: { 
					channel: this.recordController.getChannel(),
					table: event.table, 
					id: event.id, 
					operation: 'save'
				},
				bubbles: true
			}));
		}

	}

	// Handle record:ui:update events
	async handleUpdate(event) {
		// Check if this event originated from within our element scope
		if ( !this.element.contains(event.detail.element) ) {
			return; // Not our event, ignore it
		}

		const methodName = this.getMethodName(event.detail.element, "save");
		const idArgName = this.getIdArgName(event.detail.element);
		const element = event.detail.element || this.element;

		try {
			const { table, id, record } = event.detail;

			// Build parameters for CFC method
			const params = this.buildCfcParams(record, idArgName, id);
			
			// Set loading state
			this.setLoadingState(true, element);

			// Resolve path and call the CFC method through the cfc controller
			const path = this.cfcController.getPath(event.detail.element || this.element);
			this.busy(true, element);
			const result = await this.cfcController.call(path, methodName, params);

			// Fire the record:data:update event that the record controller expects
			this.fireDataEvent('update', {
				table,
				id: result.id || id, // Use returned ID if available, fallback to original
				record: result.record || record
			});

		} catch (error) {
			console.error('RecordCFC update failed:', error);
			this.fireErrorEvent('update', error, event.detail);
		} finally {
			this.busy(false, element);
			this.setLoadingState(false, element);
		}
	}

	// Handle record:ui:add events
	async handleAdd(event) {
		if ( !this.element.contains(event.detail.element) ) {
			return;
		}

		const methodName = this.getMethodName(event.detail.element, "save");
		const element = event.detail.element || this.element;

		try {
			const { table, record } = event.detail;

			// Build parameters for CFC method (no ID for new records)
			const params = this.buildCfcParams(record);
			
			this.setLoadingState(true, element);
			const path = this.cfcController.getPath(event.detail.element || this.element);
			this.busy(true, element);
			let result = await this.cfcController.call(path, methodName, params);

			// Handle result as simple string or JSON object
			if ( typeof result === 'string' ) {
				// If the result is a string, only try to parse it if it looks like JSON.
				const trimmed = result.trim();
				const looksLikeJson = trimmed.startsWith('{') ||
					trimmed.startsWith('[') ||
					trimmed.startsWith('"') ||
					/":|:\s*[\d\[{"]/.test(trimmed);

				if ( looksLikeJson ) {
					try {
						result = JSON.parse(trimmed);
					} catch (e) {
						// If parsing fails, leave as string (return early).
						console.warn('RecordCFC: failed to parse string result as JSON', e);
						return;
					}
				} else {
					result = { id: result }; // Treat as ID string
				}
			}

			// For adds, we need the new ID from the server
			if ( !result.id ) {
				throw new Error('CFC method must return an "id" field for new records');
			}

			this.fireDataEvent('add', {
				table,
				id: result.id,
				record: result.record || record
			});

		} catch (error) {
			console.error('RecordCFC add failed:', error);
			this.fireErrorEvent('add', error, event.detail);
		} finally {
			this.busy(false, element);
			this.setLoadingState(false, element);
		}
	}

	// Handle record:ui:delete events  
	async handleDelete(event) {
		if ( !this.element.contains(event.detail.element) ) {
			return;
		}

		const methodName = this.getMethodName(event.detail.element, "delete");
		const idArgName = this.getIdArgName(event.detail.element);
		const element = event.detail.element || this.element;

		try {
			const { table, id } = event.detail;

			// For deletes, typically just need the ID
			const params = this.buildCfcParams({}, idArgName, id);
			
			this.setLoadingState(true, element);
			const path = this.cfcController.getPath(event.detail.element || this.element);
			this.busy(true, element);
			await this.cfcController.call(path, methodName, params);

			this.fireDataEvent('delete', {
				table,
				id
			});

		} catch (error) {
			console.error('RecordCFC delete failed:', error);
			this.fireErrorEvent('delete', error, event.detail);
		} finally {
			this.busy(false, element);
			this.setLoadingState(false, element);
		}
	}

	// Handle record:ui:query events to load records from CFC
	async handleQuery(event) {
		// Check if this event is for our element/table
		const table = event.detail && event.detail.table ? event.detail.table : null;
		const myTable = this.recordController.getTable(table);
		const table_from = table.getAttribute('data-record-table');
		const table_to = myTable;// ? myTable.getAttribute('data-record-table') : null;
		//const table_to = myTable.getAttribute('data-record-table');
		if ( table_from && table_from !== table_to ) {
			return;
		}

		// If event has an element, ensure it's inside our scope
		if ( event.detail && event.detail.element && !this.element.contains(event.detail.element) ) {
			return;
		}

		let attr = table.hasAttribute('data-record-id') ? "data-recordcfc-method-get" : "data-recordcfc-method-gets";
		if ( !table.hasAttribute(attr) && table.hasAttribute("data-recordcfc-method-load") ) {
			console.warn(`No ${attr} configured for load`);
		}

		// Determine load method (prefer data-recordcfc-gets)
		const method = table.getAttribute(attr) || table.getAttribute('data-recordcfc-method-load');

		// Build args (merge query filter and any static args)
		let args = {};
		if ( event.detail && event.detail.filter ) {
			args = { ...args, ...event.detail.filter };
		}
		if (
			table.hasAttribute('data-recordcfc-idarg')
			&&
			table.hasAttribute('data-record-id')
		) {
			const idArgName = table.getAttribute('data-recordcfc-idarg');
			const recordId = table.getAttribute('data-record-id');
			args[idArgName] = recordId;
		}
		const argsAttr = table.getAttribute('data-recordcfc-args') || table.getAttribute('data-record-filter');
		if ( argsAttr ) {
			try {
				// Try JSON first, otherwise parse as querystring
				if ( argsAttr.trim().startsWith('{') ) {
					args = { ...args, ...JSON.parse(argsAttr) };
				} else {
					const params = new URLSearchParams(argsAttr);
					for ( const [k,v] of params ) args[k] = v;
				}
			} catch(e) {
				console.warn('Could not parse data-recordcfc-args/filter', e, argsAttr);
			}
		}

		const path = this.cfcController.getPath(table);

		this.setLoadingState(true, table);
		this.busy(true, table);

		try {
			const result = await this.cfcController.call(path, method, args);

			// Normalize result into records array
			let records = [];
			if ( Array.isArray(result) ) {
				records = result;
			} else if ( result && result.records && Array.isArray(result.records) ) {
				records = result.records;
			} else if ( result && result.data && Array.isArray(result.data) ) {
				records = result.data;
			} else if ( result ) {
				records = [ result ];
			}

			// Map id arg if configured
			let idArg = null;
			try {
				idArg = this.getIdArgName(table);
			} catch(e) {
				// optional
			}
			if ( idArg ) {
				records = records.map(r => {
					if ( r && r[idArg] !== undefined && r.id === undefined ) {
						r.id = r[idArg];
					}
					return r;
				});
			}

			this.fireDataEvent('load', { table: myTable, records, origin: table }, table);

		} catch (error) {
			console.error('RecordCFC load failed:', error);
			this.fireErrorEvent('load', error, event.detail);
		} finally {
			this.busy(false, table);
			this.setLoadingState(false, table);
		}
	}

	// Build parameters object for CFC method calls
	buildCfcParams(record, idArgName, id=null) {
		const params = { ...record };
		
		// Add ID parameter if provided and configured
		if ( idArgName && id !== null ) {
			params[idArgName] = id;
		}
		
		return params;
	}

	// Fire record:data events that the record controller expects
	fireDataEvent(action, detail, element=null) {
		const eventElement = element || this.element;

		document.dispatchEvent(new CustomEvent(`record:data:${action}`, {
			detail: {
				...detail,
				element: eventElement // Include originating element
			},
			bubbles: true
		}));
		
	}

	// Fire error events
	fireErrorEvent(action, error, originalDetail) {
		document.dispatchEvent(new CustomEvent(`record:data:error:${action}`, {
			detail: {
				error: error.message || error,
				originalEvent: originalDetail,
				element: this.element
			},
			bubbles: true
		}));
		
		console.error(`Fired record:data:error:${action}`, error);
	}

	// Set loading state with aria-busy
	setLoadingState(isLoading, element=this.element) {

		// Disable form elements during loading
		const formElements = element.querySelectorAll('input, button, select, textarea');
		formElements.forEach(el => {
			if ( isLoading ) {
				el.setAttribute('data-recordcfc-disabled', el.disabled);
				el.disabled = true;
			} else {
				const wasDisabled = el.getAttribute('data-recordcfc-disabled') === 'true';
				el.disabled = wasDisabled;
				el.removeAttribute('data-recordcfc-disabled');
			}
		});
	}

});