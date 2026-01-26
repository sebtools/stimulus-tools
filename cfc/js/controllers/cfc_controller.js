application.register('cfc', class extends Stimulus.Controller {

	initialize() {

	}

	connect() {

		this.element.cfcController = this;

		this.config();

	}

	config() {
		
		this.defaultName();
		this.makePaths();

		// We want to set up a unique "channel" for every cfc instance so that we can identify events
		if ( !this.element.hasAttribute('data-cfc-channel') ) {
			const randomStr = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
			this.element.setAttribute('data-cfc-channel', randomStr);
		}

	}

	defaultName() {
		if ( !this.element.hasAttribute('data-cfc-name') ) {
			this.element.dataset.cfcName = this.getCurrentPageName();
		}

	}

	makePathFromName(name) {
		// If no name provided, default to current page name
		if ( !name ) {
			name = this.getCurrentPageName();
		}
		
		// Ensure .cfc extension
		if ( !name.toLowerCase().endsWith('.cfc') ) {
			name += '.cfc';
		}

		return name;
	}

	// Generate data-cfc-path attributes from data-cfc-name attributes
	makePaths() {
		const names = this.element.querySelectorAll('[data-cfc-name]:not([data-cfc-path])');

		if ( !this.element.hasAttribute('data-cfc-path') ) {
			this.element.dataset.cfcPath = this.makePathFromName(this.element.getAttribute('data-cfc-name'));
		}

		names.forEach(elem => {
			elem.dataset.cfcPath = this.makePathFromName(elem.dataset.cfcName);
		});

	}

	// Get current page name (without extension) for default CFC resolution
	getCurrentPageName() {
		const pathname = window.location.pathname;
		const filename = pathname.split('/').pop();
		const nameWithoutExt = filename.split('.')[0];
		return nameWithoutExt || 'index';
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

	async call() {
		// If called with a single Event-like object, delegate to callEvent
		if ( arguments.length === 1 && this._isEvent(arguments[0]) ) {
			return await this.callEvent(arguments[0]);
		}

		// If called with (path, method, [args]) where first two args are strings
		if (
			arguments.length >= 2
			&&
			typeof arguments[0] === 'string'
			&&
			typeof arguments[1] === 'string'
		) {
			const path = arguments[0];
			const method = arguments[1];
			const args = arguments.length >= 3 ? arguments[2] : {};
			return this.callPathMethod(path, method, args);
		}

		// Future: support call({path, method}) here
		console.warn('cfc.call: unsupported signature. Expected (Event) or (path, method[, args]).');

		return null;
	}

	async callEvent(event) {

		if ( !event.target ) {
			return;
		}

		const element = event.target;
		const methodElement = this.getAttributeElement('data-cfc-method', element);
		const method = methodElement.getAttribute('data-cfc-method');
		const path = this.getAttributeElementValue('data-cfc-path', element);
		//const argString = this.getAttributeElementValue('data-cfc-args', element) || "";
		let args = this.getArgs(element);

		event.preventDefault();

		this.busy(true, methodElement);

		const result = await this.callPathMethod(path, method, args);
		
		this.handleResponse(result, event);

		this.busy(false, methodElement);

		return result;
	}

	async callPathMethod(path, method, args={}) {
		const result = await this.runCfcMethod(path, method, args);

		return result;
	}

	getArgs(element) {
		const methodElement = this.getAttributeElement('data-cfc-method', element);
		const argString = this.getAttributeElementValue('data-cfc-args', element) || "";
		let args = this.parseQueryString(argString);
		const argElements = methodElement.querySelectorAll('[data-cfc-arg]');

		// If the method element is a form or has data-cfc-form, collect form data
		if (
			methodElement.tagName === 'FORM'
			||
			methodElement.hasAttribute('data-cfc-form')
		) {
			const formData = this.collectFormData(methodElement);

			// Merge form data into args
			args = { ...args, ...formData };
		}

		// Got additional args from data-cfc-arg elements
		argElements.forEach(argElem => {
			const argName = argElem.getAttribute('data-cfc-arg');

			args[argName] = this.getElementValue(argElem);
		});

		return args;
	}

	getChannel() {
		return this.element.getAttribute('data-cfc-channel');
	}

	// Collect form data from the current element
	collectFormData(element) {
		const params = {};
		
		// If this element is a form, use FormData
		if ( element.tagName === 'FORM' ) {
			const formData = new FormData(element);
			for ( const [key, value] of formData.entries() ) {
				params[key] = value;
			}
		} else {
			// Otherwise, collect from input elements within this element
			const inputs = element.querySelectorAll('input, select, textarea');
			inputs.forEach(input => {
				if ( input.name ) {
					if ( input.type === 'checkbox' ) {
						// For checkboxes, collect all checked values with the same name
						if ( !params[input.name] ) {
							params[input.name] = [];
						}
						if ( input.checked ) {
							params[input.name].push(input.value);
						}
					} else if ( input.type === 'radio' ) {
						if ( input.checked ) {
							params[input.name] = input.value;
						}
					} else {
						params[input.name] = input.value;
					}
				}
			});
		}

		return params;
	}

	getElementValue(element) {
		let value = '';
		
		if (  !element ) {
			return value;
		}
		if ( element.hasAttribute('data-cfc-value') ) {
			value = element.getAttribute('data-cfc-value');
		} else if (  element.hasAttribute('data-value') ) {
			value = element.getAttribute('data-value');
		} else if ( element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'select' || element.tagName.toLowerCase() === 'textarea' ) {
			value = element.value;
		} else {
			value = element.textContent;
		}

		return value;
	}

	handleResponse(response,event=null) {
		if ( !event || !event.target ) {
			return;
		}

		// Find nearest target attribute
		const target = this.getAttributeElementValue('data-cfc-target', event.target);
		if ( !target ) {
			return;
		}

		// Find all receivers with matching data-cfc-receiver attribute
		const receivers = this.element.querySelectorAll(`[data-cfc-receiver="${target}"]`);
		if ( !receivers ) {
			return;
		}

		receivers.forEach(receiver => {
				if ( typeof response === 'string' ) {
					receiver.textContent = response;
				} else {
					try {
						receiver.textContent = JSON.stringify(response, null, 2);
					} catch(e) {
						receiver.textContent = String(response);
					}
				}
		});

	}

	async runCfcMethod(path, method, args={}) {
		const channel = this.getChannel();
		const url = path + '?method=' + encodeURIComponent(method);

		const { body, headers } = this.makeRequestBody(args);
		let result;

		this.dispatch('calling', {
			detail: { channel, path, method, args }
		});

		const response = await fetch(url, {
			method: 'POST',
			body: body,
			headers: headers
		});

		if ( !response.ok ) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const contentType = response.headers.get('content-type');
		if ( contentType && contentType.includes('application/json') ) {
			let json = await response.json();
			result = json;
			
			// Check for ColdFusion error response
			if ( json.ERROR ) {
				throw new Error(json.ERROR);
			}
			
			// If the host element has cfc-columns or related attrs, normalize the result
			try {
				const normalized = this.normalizeIfConfigured(json);
				if ( normalized !== null ) {
					result = normalized;
				}
			} catch(e) {
				console.warn('Error during CFC result normalization', e);
			}

		} else {
			let text = await response.text();
			result = text;

			// Try to parse JSON-like text, otherwise return as text
			const parsed = this.tryParseJson(text);
			if ( parsed !== null ) {
				result = parsed;
			}
			
			if ( parsed !== null ) {
				try {
					const normalized = this.normalizeIfConfigured(parsed);

					if ( normalized !== null ) {
						result = normalized;
					}
				} catch(e) {
					console.warn('Error during CFC result normalization', e);
				}
			}

		}

		this.dispatch('called', {
			detail: { channel, path, method, args, response, result }
		});

		return result;
	}

	// Try to parse a response text as JSON. Returns parsed object or null.
	tryParseJson(text) {
		try {
			const trimmed = text.trim();
			if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
				const parsed = JSON.parse(text);
				if (parsed && parsed.ERROR) {
					throw new Error(parsed.ERROR);
				}
				return parsed;
			}
		} catch (e) {
			// ignore and return null
		}
		return null;
	}

	// If the controller element has normalization attributes, build options and normalize parsed result.
	// Returns normalized result array/object or null if no normalization configured on this.element.
	normalizeIfConfigured(parsed) {
		const columnsAttr = this.element.getAttribute('data-cfc-columns');
		let columnsMap = null;
		if ( columnsAttr ) {
			try {
				columnsMap = JSON.parse(columnsAttr);
			} catch(e) {
				console.warn('data-cfc-columns JSON parse error', e, columnsAttr);
			}
		}

		const caseOption = this.element.getAttribute('data-cfc-column-case') || 'lower';
		const typesAttr = this.element.getAttribute('data-cfc-column-types');
		let typesMap = null;
		if ( typesAttr ) {
			try {
				typesMap = JSON.parse(typesAttr);
			} catch(e) {
				console.warn('data-cfc-column-types JSON parse error', e, typesAttr);
			}
		}

		return this.normalizeCfcResult(parsed, {
			columnsMap,
			caseOption,
			typesMap
		});
	}

	// Normalize various ColdFusion query/response shapes into an array of objects
	normalizeCfcResult(parsed, options={}) {
		// options: { columnsMap, caseOption, typesMap }
		options = options || {};
		const columnsMap = options.columnsMap || null;
		const caseOption = options.caseOption || 'lower';
		const typesMap = options.typesMap || null;

		// If already an array of objects, return after applying mapping/coercion
		if ( Array.isArray(parsed) ) {
			return parsed.map(row => this.mapColumnsAndCoerce(row, { columnsMap, caseOption, typesMap }));
		}

		// If an object, try to detect CF query shapes
		if ( parsed && typeof parsed === 'object' ) {
			// Unwrap common wrappers like { query: {...} } or { data: [...] }
			if ( parsed.query && (parsed.query.COLUMNS || parsed.query.DATA) ) {
				parsed = parsed.query;
			}
			if ( parsed.data && Array.isArray(parsed.data) ) {
				// data could be array of arrays or array of objects
				if ( parsed.columns && Array.isArray(parsed.columns) ) {
					// meta style: { data:[...], columns:[...] }
					return this._fromColumnsAndRows(parsed.columns, parsed.data, { columnsMap, caseOption, typesMap });
				}
				return parsed.data.map(row => this.mapColumnsAndCoerce(row, { columnsMap, caseOption, typesMap }));
			}

			// Detect COLUMNS/DATA style
			const keys = Object.keys(parsed);
			const hasColumns = keys.some(k => k.toUpperCase() === 'COLUMNS');
			const hasData = keys.some(k => k.toUpperCase() === 'DATA');
			if ( hasColumns && hasData ) {
				const columns = parsed[ keys.find(k => k.toUpperCase() === 'COLUMNS') ];
				const data = parsed[ keys.find(k => k.toUpperCase() === 'DATA') ];
				return this._fromColumnsAndRows(columns, data, { columnsMap, caseOption, typesMap });
			}

			// Column-centric object { col1: [...], col2: [...] }
			const arrayValues = keys.filter(k => Array.isArray(parsed[k]));
			if ( arrayValues.length === keys.length && keys.length > 0 ) {
				const len = parsed[keys[0]].length;
				const rows = [];
				for ( let i=0;i<len;i++ ) {
					const row = {};
					keys.forEach(k => row[k] = parsed[k][i]);
					rows.push(this.mapColumnsAndCoerce(row, { columnsMap, caseOption, typesMap }));
				}
				return rows;
			}

			// If it's a single object (a record), map its keys
			return [ this.mapColumnsAndCoerce(parsed, { columnsMap, caseOption, typesMap }) ];
		}

		// Fallback: return as single-element array
		return [ parsed ];
	}

	// Convert COLUMNS + DATA arrays into array of objects and apply mapping/coercion
	_fromColumnsAndRows(columns, data, options={}) {
		const result = [];
		for ( const rowArr of data ) {
			const obj = {};
			for ( let i=0;i<columns.length;i++ ) {
				obj[columns[i]] = rowArr[i];
			}
			result.push(this.mapColumnsAndCoerce(obj, options));
		}
		return result;
	}

	// Map column names according to columnsMap and apply type coercion
	mapColumnsAndCoerce(rowObj, options={}) {
		const columnsMap = options.columnsMap || null;
		const caseOption = options.caseOption || 'lower';
		const typesMap = options.typesMap || null;
		const out = {};
		for ( const origKey of Object.keys(rowObj) ) {
			const value = rowObj[origKey];
			let mappingEntry = null;
			let mappedKey = null;

			if ( columnsMap ) {
				// Exact match
				if ( columnsMap.hasOwnProperty(origKey) ) {
					mappingEntry = columnsMap[origKey];
					mappedKey = this._resolveMappedNameFromEntry(origKey, mappingEntry);
				} else {
					// Case-insensitive search
					const lowerKeys = Object.keys(columnsMap).find(k => k.toLowerCase() === origKey.toLowerCase());
					if ( lowerKeys ) {
						mappingEntry = columnsMap[lowerKeys];
						mappedKey = this._resolveMappedNameFromEntry(lowerKeys, mappingEntry);
					}
				}
			}

			if ( !mappedKey ) {
				// Default behavior: apply caseOption to origKey
				mappedKey = this._transformKeyCase(origKey, caseOption);
			}

			let finalValue = value;
			// Determine if we have an explicit type for this mappedKey or origKey
			const typeForKey = (typesMap && (typesMap[mappedKey] || typesMap[origKey])) ? (typesMap[mappedKey] || typesMap[origKey]) : null;
			if ( typeForKey ) {
				finalValue = this._coerceType(value, typeForKey);
			}

			out[mappedKey] = finalValue;
		}
		return out;
	}

	_resolveMappedNameFromEntry(key, entry) {
		if ( typeof entry === 'string' ) return entry;
		if ( entry && typeof entry === 'object' && entry.name ) return entry.name;
		// If entry exists but no name, use the mapping key itself
		return key;
	}

	_transformKeyCase(key, caseOption) {
		switch(caseOption) {
			case 'upper': return key.toUpperCase();
			case 'camel': return key.replace(/[_\- ]+(.)/g, (m,p)=>p.toUpperCase()).replace(/^(.)/, (m,p)=>p.toLowerCase());
			case 'preserve': return key;
			case 'lower':
			default:
				return key.toLowerCase();
		}
	}

	_coerceType(value, type) {
		if ( value === null || value === undefined ) return value;
		const t = ('' + type).toLowerCase();
		switch(t) {
			case 'int':
			case 'integer': {
				const n = parseInt(value,10);
				return isNaN(n) ? value : n;
			}
			case 'float':
			case 'number': {
				const f = parseFloat(value);
				return isNaN(f) ? value : f;
			}
			case 'boolean': {
				if ( typeof value === 'boolean' ) return value;
				const s = (''+value).toLowerCase();
				if ( s === 'true' || s === '1' ) return true;
				if ( s === 'false' || s === '0' ) return false;
				return value;
			}
			case 'date': {
				// Try to parse ISO dates, fallback to original string
				const d = new Date(value);
				if ( !isNaN(d.getTime()) ) return d;
				return value;
			}
			case 'string':
			default:
				return value;
		}
	}

	getPath(element) {
		const pathElement = this.getAttributeElement('data-cfc-path', element);
		return pathElement.getAttribute('data-cfc-path') || '';
	}

	busy(isBusy, element) {
		const methodElement = this.getAttributeElement('data-cfc-method', element);

		if  ( !(this.element.hasAttribute('data-cfc-usebusy') && this.element.getAttribute('data-cfc-usebusy') === 'false') ) {
			methodElement.ariaBusy = isBusy;
		}

	}

	// Build a fetch request body and headers from various arg types
	makeRequestBody(args) {
		let body = null;
		let headers = {};

		// If args is already FormData, URLSearchParams or a string, pass through
		if ( args instanceof FormData || args instanceof URLSearchParams || typeof args === 'string' ) {
			body = args;
		} else if ( args && typeof args === 'object' ) {
			// Convert plain object to FormData so ColdFusion receives form-encoded POST data
			body = new FormData();
			for ( const key of Object.keys(args) ) {
				const val = args[key];
				if ( Array.isArray(val) ) {
					val.forEach(v => body.append(key, v));
				} else if ( val === null || val === undefined ) {
					// skip null/undefined
				} else {
					body.append(key, val);
				}
			}
		} else {
			body = null;
		}

		return { body, headers };
	}

	parseQueryString(qs) {
		const params = new URLSearchParams(qs);
		const result = {};

		for ( const [key, value] of params ) {
			if (result[key] === undefined) {
				result[key] = value;
			} else if (Array.isArray(result[key])) {
				result[key].push(value);
			} else {
				result[key] = [result[key], value];
			}
		}

		return result;
	}


	// Simple runtime check for DOM Event-ish objects

	_isEvent(obj) {
		if ( !obj || typeof obj !== 'object' ) return false;
		// Common Event methods we can test for
		return (typeof obj.preventDefault === 'function') || (typeof obj.stopPropagation === 'function');
	}

})