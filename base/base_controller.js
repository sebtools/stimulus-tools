// NOT used by extension. This is instead just the file from which a controller is created.
application.register('{{name}}', class extends Stimulus.Controller {
	//static targets = [];

	initialize() {
		this.dispatch("initialized");
	}

	connect() {

		this.config();

		//Attaching controller to object so we can call methods on it.
		this.element[this.identifier] = this;

		this.dispatch("connected");

	}

	config() {


	}

	disconnect() {
		this.dispatch("disconnected");
	}

	busy(isBusy) {

		// Add or remove identifier from busywith attribute to indicate that the element is busy with this controller
		if ( isBusy ) {
			this.element.dataset.busywith = (this.element.dataset.busywith || '') + ' ' + this.identifier;
		} else {
			this.element.dataset.busywith = (this.element.dataset.busywith || '').replace(this.identifier, '').trim();
		}

		// Set aria-busy attribute to indicate that the element is doing anything
		this.element.ariaBusy = ( this.element.dataset.busywith.length > 0 );

	}

	//Label uses data-label attribute, then data-name, then textContent
	getLabel(elem) {
		
		if ( elem.hasAttribute(`data-$(this.identifier)-label`) ) {
			return elem.getAttribute("data-$(this.identifier)-label").trim();
		} else if ( elem.hasAttribute("data-label") ) {
			return elem.getAttribute("data-label").trim();
		} else if ( elem.hasAttribute(`data-$(this.identifier)-name`) ) {
			return elem.getAttribute("data-$(this.identifier)-name").trim();
		} else if ( elem.hasAttribute("data-name") ) {
			return elem.getAttribute("data-name").trim();
		} else {
			return elem.textContent.trim();
		}
	}

	//Name uses data-name attribute, then data-value, then textContent
	getName(elem) {

		if ( elem.hasAttribute(`data-$(this.identifier)-name`) ) {
			return elem.getAttribute("data-$(this.identifier)-name").trim();
		} else if ( elem.hasAttribute("data-name") ) {
			return elem.getAttribute("data-name").trim();
		} else if ( elem.hasAttribute("data-$(this.identifier)-value") ) {
			return elem.getAttribute("data-$(this.identifier)-value").trim();
		} else if ( elem.hasAttribute("data-value") ) {
			return elem.getAttribute("data-value");
		} else {
			return elem.textContent.trim();
		}
	}

	//Value uses data-value attribute, then textContent
	getValue(elem) {
		var result = "";
		var datas = elem.getElementsByTagName("data");
		var inputs = elem.getElementsByTagName("input");

		if ( elem.hasAttribute("data-$(this.identifier)-value") ) {
			result = elem.getAttribute("data-$(this.identifier)-value").trim();
	 	} else if ( elem.hasAttribute("data-value") ) {
			result = elem.getAttribute("data-value");
		} else if ( datas.length == 1 ) {
			result = datas[0].value;
		} else if ( elem.textContent.length == 0 && inputs.length == 1 ) {
			if ( inputs[0].type == "checkbox" || inputs[0].type == "radio" ) {
				result = inputs[0].checked ? "1" : "0";
			} else {
				result = inputs[0].value;
			}
		} else {
			result = elem.textContent;
		}

		result = result.trim();

		result = this._cleanCurrency(result);

		return result;
	}

	// Clean the currency string by removing symbols and commas
	_cleanCurrency(str) {

		if ( /^[$€£]?\s?\d{1,3}([,.\s]?\d{3})*(\.\d{2})?$/.test(str) ) {
			return str.replace(/[^0-9.]/g, ''); // Remove currency symbols and commas
		} else {
			return str; // Return original string if no match is found
		}
	}

})