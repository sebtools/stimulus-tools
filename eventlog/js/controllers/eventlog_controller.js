application.register('eventlog', class extends Stimulus.Controller {

	connect() {
		
		this.addCSS();

		this.eventCount = 0;

		this.setupEventListeners();

	}

	disconnect() {
		// Cleanup if necessary
		this.removeEventListeners();
	}

	addCSS() {
		const style = document.createElement('style');
		style.textContent = `
			[data-json-type="key"] { color: #0451a5; }
			[data-json-type="string"] { color: #0e7d0e; }
			[data-json-type="number"] { color: #e91e63; }
			[data-json-type="boolean"] { color: #0000ff; }
			[data-json-type="null"] { color: #808080; }
			[data-json-type="dom"] { color: #d2691e; font-style: italic; }

			/* Preserve indentation and spacing for JSON output */
			.event-entry small pre.event-json {
				background-color: white;
				white-space: pre-wrap; /* preserve newlines and wrap long lines */
				font-family: monospace;
				margin: 0;
				padding: 0;
			}
		`;
		document.head.appendChild(style);

	}

	getEventsArray() {
		if ( !this.element.hasAttribute('data-eventlog-events') ) {
			return [];
		}
		const events = this.element.getAttribute('data-eventlog-events').split(' ');

		return events;
	}

	removeEventListeners() {
		const events = this.getEventsArray();
		events.forEach(eventName => {
			document.removeEventListener(eventName, this.boundLogEvent);
		});
	}

	setupEventListeners() {

		this.boundLogEvent = (event) => {
			this.logEvent(
				this.getEventType(event.type),
				event.type,
				event.detail
			);
		};

		const events = this.getEventsArray();
		console.log('Setting up event listeners for:', events);
		events.forEach(eventName => {
			document.addEventListener(eventName, this.boundLogEvent);
		});

	}

	getEventType(eventName) {
		if ( eventName.includes(':') ) {
			const parts = eventName.split(':');
			parts.pop();
			return parts.join('_');
		}
		return eventName;
	}

	logEvent(type, eventName, detail) {
		this.eventCount++;
		const entry = document.createElement('div');
		entry.className = `event-entry event-${type}`;
		entry.innerHTML = `
			<strong>#${this.eventCount} ${eventName}</strong><br>
			<small><pre class="event-json">${this.prettyJsonHtml(detail)}</pre></small>
		`;
		this.element.insertBefore(entry, this.element.firstChild);
		
		// Keep only last 20 events
		while ( this.element.children.length > 20 ) {
			this.element.removeChild(this.element.lastChild);
		}
	}

	addEventListener(eventName) {
		// Add to the data attribute if not already present
		const currentEvents = this.getEventsArray();
		if (!currentEvents.includes(eventName)) {
			currentEvents.push(eventName);
			this.element.setAttribute('data-eventlog-events', currentEvents.join(' '));
			document.addEventListener(eventName, this.boundLogEvent);
		}
	}

	clear() {
		this.element.innerHTML = '';
		this.eventCount = 0;
	}

	prettyJsonHtml(obj) {
		// Option for how to serialize DOM elements: set attribute
		// on the controller's element: data-eventlog-serialize-dom="element" or "json"
		// - "json" (default): attempt to stringify the element (may produce lots of output)
		// - "element": replace DOM elements with a short label like "[DOM Element: <div#id.class>]"
		const domHandling = this.element.getAttribute('data-eventlog-serialize-dom') || 'json';

		// Safe stringify that handles circular references by replacing them with "[Circular]"
		// and optionally replaces DOM Elements with a concise label when domHandling === 'element'.
		function safeStringify(value) {
			try {
				const seen = new WeakSet();
				return JSON.stringify(value, (k, v) => {
					// Replace DOM elements with a short label when requested
					if (domHandling === 'element' && typeof Element !== 'undefined' && v instanceof Element) {
						const tag = v.tagName ? v.tagName.toLowerCase() : 'element';
						const id = v.id ? `#${v.id}` : '';
						const cls = v.className ? `.${String(v.className).trim().replace(/\s+/g, '.')}` : '';
						return `[DOM Element: <${tag}${id}${cls}>]`;
					}
					if (typeof v === 'object' && v !== null) {
						if (seen.has(v)) return '[Circular]';
						seen.add(v);
					}
					return v;
				}, 2);
			} catch (e) {
				// Fallback for values that JSON.stringify still can't handle
				try {
					return String(value);
				} catch (e2) {
					return '"[Unserializable]"';
				}
			}
		}

		const json = safeStringify(obj) || '"undefined"';

		function escapeHtml(str) {
			return String(str)
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;');
		}

		return json.replace(
			/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
			match => {
				let type = 'number';

				if (/^"/.test(match)) {
					type = /:$/.test(match) ? 'key' : 'string';
				} else if (/true|false/.test(match)) {
					type = 'boolean';
				} else if (/null/.test(match)) {
					type = 'null';
				}

				return `<span data-json-type="${type}">${escapeHtml(match)}</span>`;
			}
		);
	}

});