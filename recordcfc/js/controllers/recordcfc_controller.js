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
		
		// Set up event listeners for record UI events
		this.setupEventListeners();
		
		// Defensive autoload: if the record controller requested an initial load
		// before this controller connected, perform the load now. This avoids
		// races where record dispatches requestInitialLoad() before listeners
		// are attached. We check the controller element for data-record-autoload
		// and the marker set by requestInitialLoad().
		try {
			const auto = this.element.getAttribute('data-record-autoload');
			const initialRequested = this.element.dataset.recordInitialLoadRequested;
			if ( (auto === 'true' || auto === true) && initialRequested ) {
				// Synthesize a query event targeted at this table/element
				setTimeout(() => {
					this.handleQuery(new CustomEvent('record:ui:query', { detail: { table: this.recordController.getTable(this.element), element: this.element } }));
				}, 0);
			}
		} catch(e) {
			// ignore defensive autoload failures
		}
		
		console.log('RecordCFC controller connected');
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
	busy(isBusy, element) {
		const methodElement = element || this.element;
		try {
			//methodElement.ariaBusy = isBusy;
		} catch (e) {
			// ignore
		}
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

		try {
			const { table, id, record } = event.detail;

			// Build parameters for CFC method
			const params = this.buildCfcParams(record, idArgName, id);
			
			// Set loading state
			this.setLoadingState(true);

			// Resolve path and call the CFC method through the cfc controller
			const path = this.cfcController.getPath(event.detail.element || this.element);
			this.busy(true, event.detail.element || this.element);
			const result = await this.cfcController.call(path, methodName, params);

			// ToDo: Handle result as simple string or JSON object
			
			// Fire the record:data:update event that the record controller expects
			this.fireDataEvent('update', {
				table,
				id: result.id || id, // Use returned ID if available, fallback to original
				record: result.record || record
			});

			// ToDo: Add element and have record controller use it.

		} catch (error) {
			console.error('RecordCFC update failed:', error);
			this.fireErrorEvent('update', error, event.detail);
		} finally {
			this.busy(false, event.detail.element || this.element);
			this.setLoadingState(false);
		}
	}

	// Handle record:ui:add events
	async handleAdd(event) {
		if ( !this.element.contains(event.detail.element) ) {
			return;
		}

		const methodName = this.getMethodName(event.detail.element, "save");

		try {
			const { table, record } = event.detail;

			// Build parameters for CFC method (no ID for new records)
			const params = this.buildCfcParams(record);
			
			this.setLoadingState(true);
			const path = this.cfcController.getPath(event.detail.element || this.element);
			this.busy(true, event.detail.element || this.element);
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

			// ToDo: Add element and have record controller use it.

			this.fireDataEvent('add', {
				table,
				id: result.id,
				record: result.record || record
			});

		} catch (error) {
			console.error('RecordCFC add failed:', error);
			this.fireErrorEvent('add', error, event.detail);
		} finally {
			this.busy(false, event.detail.element || this.element);
			this.setLoadingState(false);
		}
	}

	// Handle record:ui:delete events  
	async handleDelete(event) {
		if ( !this.element.contains(event.detail.element) ) {
			return;
		}

		const methodName = this.getMethodName(event.detail.element, "delete");
		const idArgName = this.getIdArgName(event.detail.element);

		console.log('RecordCFC handling delete event:', event.detail);

		try {
			const { table, id } = event.detail;

			// For deletes, typically just need the ID
			const params = this.buildCfcParams({}, idArgName, id);
			
			this.setLoadingState(true);
			const path = this.cfcController.getPath(event.detail.element || this.element);
			this.busy(true, event.detail.element || this.element);
			await this.cfcController.call(path, methodName, params);

			// ToDo: Add element and have record controller use it.
			
			this.fireDataEvent('delete', {
				table,
				id
			});

		} catch (error) {
			console.error('RecordCFC delete failed:', error);
			this.fireErrorEvent('delete', error, event.detail);
		} finally {
			this.busy(false, event.detail.element || this.element);
			this.setLoadingState(false);
		}
	}

	// Handle record:ui:query events to load records from CFC
	async handleQuery(event) {
		// Check if this event is for our element/table
		console.log('RecordCFC handling query event:', event.detail);
		const table = event.detail && event.detail.table ? event.detail.table : null;
		const myTable = this.recordController.getTable(this.element);
		console.log('RecordCFC handling query from table:', table);
		console.log('RecordCFC handling query to table:', myTable);
		if ( table && table !== myTable ) {
			return;
		}

		console.log('RecordCFC handling query for table:', myTable);

		// If event has an element, ensure it's inside our scope
		if ( event.detail && event.detail.element && !this.element.contains(event.detail.element) ) {
			return;
		}

		// Determine load method (prefer data-recordcfc-gets)
		const method = this.element.getAttribute('data-recordcfc-gets') || this.element.getAttribute('data-recordcfc-method-load');
		if ( !method ) {
			console.warn('No data-recordcfc-gets configured for load');
			return;
		}

		console.log('RecordCFC loading records using method:', method);

		// Build args (merge query filter and any static args)
		let args = {};
		if ( event.detail && event.detail.filter ) {
			args = { ...args, ...event.detail.filter };
		}
		const argsAttr = this.element.getAttribute('data-recordcfc-args') || this.element.getAttribute('data-record-filter');
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

		const path = this.cfcController.getPath(this.element);

		this.setLoadingState(true);
		this.busy(true, this.element);

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
				idArg = this.getIdArgName(this.element);
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

			this.fireDataEvent('load', { table: myTable, records }, this.element);

		} catch (error) {
			console.error('RecordCFC load failed:', error);
			this.fireErrorEvent('load', error, event.detail);
		} finally {
			this.busy(false, this.element);
			this.setLoadingState(false);
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
		
		console.log(`Fired record:data:${action}`, detail);
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
	setLoadingState(isLoading) {
		// ToDo: Add/remove keys to data-busywith attribute to decide if busy or not
		//this.element.setAttribute('aria-busy', isLoading.toString());
		
		// ToDo: Disabling should be drawn on actual value of aria-busy

		// Optionally disable form elements during loading
		const formElements = this.element.querySelectorAll('input, button, select, textarea');
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