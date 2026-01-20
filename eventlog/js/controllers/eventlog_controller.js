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
			<small>${this.prettyJsonHtml(detail)}</small>
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
		const json = JSON.stringify(obj, null, 2);

		return json.replace(
			/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
			match => {
				let type = "number";

				if (/^"/.test(match)) {
					type = /:$/.test(match) ? "key" : "string";
				} else if (/true|false/.test(match)) {
					type = "boolean";
				} else if (/null/.test(match)) {
					type = "null";
				}

				return `<span data-json-type="${type}">${match}</span>`;
			}
		);
	}

});