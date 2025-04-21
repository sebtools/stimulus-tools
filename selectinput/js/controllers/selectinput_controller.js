application.register('selectinput', class extends Stimulus.Controller {
	static targets = ["select","input","datalist"];

	initialize() {
		this.dispatch("initialized");
	}

	connect() {
		this.config();

		this.eventSource = "";

		this.dispatch("connected");
	}

	disconnect() {

		// Remove the datalist and input elements
		if ( this.datalist ) {
			this.datalist.remove();
		}
		if ( this.input ) {
			this.input.remove();
		}
		// Show the original select element
		if ( this.selectTarget ) {
			this.selectTarget.style.display = "";
		}
		// Remove the list attribute from the select element
		if ( this.selectTarget ) {
			this.selectTarget.removeAttribute("list");
		}

		this.dispatch("disconnected");
	}

	config() {
		this.assignSelectTarget();
		this.ensurePlaceholder();

		this._createElems();
		
	}

	assignSelectTarget() {
		if ( !this.hasSelectTarget ) {
			if ( this.element.tagName.toLowerCase() !== 'select' ) {
				throw new Error("You must either set the 'select' target or use a <select> as the root element.");
			}
			this.element.setAttribute("data-selectinput-target", "select");
		}

		if ( !this.selectTarget.id ) {
			const randomId = 'selectinput-' + Math.random().toString(36).substr(2, 9);
			this.selectTarget.id = randomId;
		}

	}

	copyAttributes() {
		if ( this.selectTarget.hasAttribute('required') ) {
			this.input.setAttribute('required', 'required');
		} else {
			this.input.removeAttribute('required');
		}

		//Copy the styles of the select to the input
		const computedStyle = window.getComputedStyle(this.selectTarget);
		for ( let property of computedStyle ) {
			this.input.style[property] = computedStyle.getPropertyValue(property);
		}
		this.selectTarget.style.display = "none";
		this.input.style.display = "";
	}

	copyOptions() {
		//Copy all options from the select to the datalist. Want to keep all extra attributes of each option.
		//this.datalist.innerHTML = this.selectTarget.innerHTML;
		const options = Array.from(this.selectTarget.options);
		const datalist = this.datalist;

		//this.datalist.innerHTML = this.selectTarget.innerHTML;
		options.forEach(option => {
			if ( option.value === "" ) return;
			const optionElem = document.createElement('option');
			optionElem.value = option.value;
			optionElem.label = option.label;
			datalist.appendChild(optionElem);
		});

	}

	fixValues() {
		const options = Array.from(this.selectTarget.options);
		const input = this.input;

		options.forEach(option => {
			if ( option.value === input.value ) {
				this.selectTarget.value = option.value;
				this.input.value = option.label;
			}
		});

	}

	ensurePlaceholder() {
		if ( !this.selectTarget.hasAttribute("data-selectinput-placeholder"))  {
			
			if ( this.selectTarget.hasAttribute("data-placeholder"))  {
				//If data-placeholder is set, copy it to data-selectinput-placeholder
				this.selectTarget.setAttribute(
					"data-selectinput-placeholder",
					this.selectTarget.getAttribute("data-placeholder")
				);
			} else {
				//Otherwise, set data-selectinput-placeholder to "Search..."
				this.selectTarget.setAttribute("data-selectinput-placeholder", "Search...");
			}
		}
	}

	_createElems() {
		// Hide original select
		this.selectTarget.hidden = true;
		
		if ( ! this.hasInputTarget ) {
			this._createInput();
		}

		if ( ! this.hasDatalistTarget ) {
			this._createDatalist();
		}
		
	}

	_createDatalist() {
		var oDatalist = document.createElement("datalist");
		oDatalist.id = this.selectTarget.id + "-datalist";

		this.selectTarget.setAttribute("list", oDatalist.id);

		this.selectTarget.parentNode.insertBefore(oDatalist, this.selectTarget);

		oDatalist.setAttribute("data-selectinput-target", "datalist");
		this.datalist = oDatalist;

		// Listen for changes to the options of the select target
		const observer = new MutationObserver(() => {
			this.copyOptions();
		});
		observer.observe(this.selectTarget, { childList: true });
		this.copyOptions();

	}

	_createInput() {
		var oInput = document.createElement("input");

		oInput.type = "text";
		oInput.placeholder = this.selectTarget.getAttribute("data-selectinput-placeholder");
		oInput.autocomplete="off"
		
		//Add ths input to the DOM
		this.selectTarget.parentNode.insertBefore(oInput, this.selectTarget);

		//Set the data-selectinput-target attribute to "input"
		oInput.setAttribute("list", this.selectTarget.id + "-datalist");
		oInput.setAttribute("data-selectinput-target", "input");

		//Setting the input target seems not to work here, so this should make the object available elsewhere
		this.input = oInput;

		this.input.disabled = true;

		//Add event listeners. The upshot is to populat the select with the value and show the label in the input
		oInput.addEventListener('keydown', (e) => {
			this._type(e);
		});
		oInput.addEventListener('input', (e) => {
			this._input(e)
		});

		//Prevent invalid values from being entered
		oInput.addEventListener('blur', () => {
			this._clearInputIfInvalid();
		});

		//Prevent invalid values from being submitted
		const form = this.selectTarget.closest('form');
		if ( form ) {
			form.addEventListener('submit', (e) => {
				this._clearInputIfInvalid();
			});
		}

		// Listen for changes to the options of the select target
		const observer = new MutationObserver(() => {
			this.copyAttributes();
		});
		observer.observe(this.selectTarget, { attributes: true });
		this.copyAttributes();

		this.input.disabled = false;

	}

	_clearInputIfInvalid() {
		const options = Array.from(this.selectTarget.options);
		const input = this.input;

		if ( !options.some(option => option.label === input.value) ) {
			input.value = '';
		}

	}

	_type(e) {
		this.eventSource = e.key ? 'typed' : 'clicked';
	}

	_input(e) {
		
		this.fixValues();

	}
	
})