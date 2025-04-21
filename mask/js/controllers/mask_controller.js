const MASK_ALIASES = {
	phone: '(000) 000-0000',
	creditCard: '0000 0000 0000 0000',
	date: '00/00/0000',
	ssn: '000-00-0000',
	zip: '00000[-0000]',
	zip5: '00000',
	zip4: '0000',
	Number: window["Number"]
}

application.register('mask', class extends Stimulus.Controller {
	static values = {
		pattern: String,
		output: String
	}

	static targets = ["output"];

	initialize() {

		this.dispatch("initialized");

	}

	connect() {
		this.applyMask();
		
		this.watch();

		this.dispatch("connected");

	}

	disconnect() {
		
		this.unwatch();
		if ( this.observeSource ) {
			this.observeSource.disconnect();
		}
		//this.element.removeAttribute('data-mask-raw');

		this.dispatch("disconnected");
		
	}

	changeSource() {
		
		this.unwatch();
		this.watch();

		this.applyMask();

		this.dispatch("source-changed");

	}

	unwatch() {
		if ( this.observer ) {
			this.observer.disconnect();
		}
		if ( this.interval ) {
			clearInterval(this.interval);
		}
	}

	watch() {
		const sourceMode = this.getSourceMode();

		const source = sourceMode.split(":")[0];
		const sourceValue = sourceMode.split(":")[1];

		this.observer = new MutationObserver(() => this.applyMask());

		switch(source) {
			case "attr":
				this._watchAttribute(sourceValue);
				break;
			case "html":
				this._watchHtml();
				break;
			case "value":
				this._watchValue();
				break;
			default:
				console.warn(`Unknown source mode: ${source}`);
		};

	};

	watchSource() {
		
		this.observeSource = new MutationObserver(() => this.changeSource());

		this.observeSource.observe(this.element, {
			attributes: true,
			attributeFilter: ["data-mask-source"]
		});

	}

	applyMask() {
		const raw = this.readSourceValue();
		const outputMode = this.getOutputMode();
		const mask = this.getMask();
		const output = this.outputElement();

		const masked = mask
		  ? this.maskValue(raw, mask)
		  : raw

		  //console.log("masked", masked);
		
		this.writeToOutput(output, masked, outputMode);

		// ✅ Store raw value
		//output.setAttribute('data-mask-raw', raw);

		this.dispatch("applied", { detail: { raw:raw, masked:masked } });
	}

	getPattern() {
		return this.element.dataset.maskPattern || this.patternValue
	}

	getMask() {
		const pattern = this.getPattern();
		const mask = MASK_ALIASES[pattern] || pattern

		return mask;
	}

	getOutputMode() {
		return this.element.dataset.maskOutput || this.outputValue || this.getOutputModeDefault();
	}

	getOutputModeDefault() {
		const tagName = this.element.tagName.toLowerCase();

		switch(tagName) {
			case "input":
				return "value";
			case "select":
				return "value";
			default:
				return "html";
		}
	}

	getSourceMode() {
		return this.element.dataset.maskSource || this.getSourceModeDefault();
	}

	getSourceModeDefault() {
		const tagName = this.element.tagName.toLowerCase();

		switch(tagName) {
			case "data":
				return "value";
			case "input":
				return "value";
			case "select":
				return "value";
			default:
				if ( this.element.hasAttribute("data-value") ) {
					return "attr:data-value";
				} else {
					return "html";
				}
		}
	};

	maskValue(raw, pattern) {
		let config = {};

		if ( this.element.hasAttribute("data-mask-options") ) {
			const options = this.element.getAttribute("data-mask-options");
			try {
				config = JSON.parse(options);
			} catch (error) {
				console.warn("Invalid JSON in data-mask-options attribute:", error);
			}
		}

		config.mask = pattern;

		if ( config.mask === window["Number"] ) {
			if ( !config.hasOwnProperty("thousandsSeparator") ) {
				config.thousandsSeparator = ",";
			}
			if ( !config.hasOwnProperty("scale") ) {
				config.scale = 0;
			}
		}

		const mask = IMask.createMask(config);
		mask.resolve(raw);

		return mask.value
	}

	outputElement() {
		if (this.hasOutputTarget) {
			return this.outputTarget
		} else if (this.element.dataset.maskTarget === "self") {
			return this.element
		} else {
			return this.element
		}
	}

	readSourceValue() {
		const source = this.getSourceMode();
	  
		if ( source === "value" ) {
			return this.element.value
		} else if ( source.startsWith("attr:") ) {
			const attr = source.split(":")[1]
			return this.element.getAttribute(attr)
		} else {
			return this.element.innerHTML
		}
	}

	writeToOutput(el, value, mode) {
		if ( mode === "html" ) {
			el.innerHTML = value;
		} else if ( mode === "value" ) {
			el.value = value;
		} else if ( mode.startsWith("attr:") ) {
			const attr = mode.split(":")[1];
			el.setAttribute(attr, value);
		}
	}

	_getValueInterval() {
		return this.element.dataset.maskValueInterval || 200;
	}

	_watchAttribute(attr) {
		this.observer.observe(this.element, {
			attributes: true,
			attributeFilter: [attr]
		});
	}

	_watchHtml() {
		this.observer.observe(this.element, {
			childList: true,
			subtree: true
		});
	}

	_watchValue() {
		const input = this.element;
		let lastValue = input.value;
		
		// Need to catch changes to the input value either by person or by JS
		// MutationObserver only catches DOM changes and value isn't an attribute nor a child element.
		// Event listeners only catch user input, not JS changes
		// So we use an interval to manully catch the value change
		this.interval = setInterval(() => {
			if ( input.value !== lastValue ) {
				lastValue = input.value;
				this.applyMask();
			}
		}, this._getValueInterval());

	}

});