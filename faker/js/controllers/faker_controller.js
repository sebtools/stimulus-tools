const { faker } = await import('https://esm.sh/@faker-js/faker');

/*
 * Stimulus controller for Faker.js
 * This controller will load Faker.js and use it to generate fake data for the element.
 * It will also allow you to use Faker.js methods in your HTML using data attributes.
 * For example, you can use data-faker-html="person.fullName" to set the innerHTML of the element to a random name.
 * 
 */

application.register('faker', class extends Stimulus.Controller {

	initialize() {
		
		this.dispatch("initialized");

	}

	connect() {

		this.config();

		this._loadFaker();

		//Attaching controller to object so we can call methods on it.

		this.element[this.identifier] = this;

		this._createRecords();
		this._loadData();

		this._setMutationObservers();

		this.dispatch("connected");

	}

	disconnect() {

		this.dispatch("disconnected");

	}

	config() {


	}

	_cloneElement(elem) {
		const clone = elem.cloneNode(true); // true means deep clone (including child elements)

		this.loadElements(clone,true);

		elem.parentNode.insertBefore(clone, elem.nextSibling); // insert clone after original
	}

	_createRecords() {

		//Make sure every element with a data-faker-records attribute has a unique id.
		this.element.querySelectorAll('[data-faker-records]:not([data-faker-recordset])').forEach(elem => {
			elem.dataset.fakerRecordset = faker.string.uuid();
		});

		//Get all elements with a data-faker-recordset attribute.
		const recordset = this.element.querySelectorAll('[data-faker-recordset]');
		
		if ( recordset.length > 0 ) {
			const elem = recordset[0];

			// Add enough elements to get to the records count.
			while ( document.querySelectorAll(`[data-faker-recordset="${elem.getAttribute('data-faker-recordset')}"]`).length < parseInt(elem.dataset.fakerRecords, 10) ) {
				this._cloneElement(elem);
			}

			//Remove enough elements to get to the records count.
			while( document.querySelectorAll(`[data-faker-recordset="${elem.getAttribute('data-faker-recordset')}"]`).length > parseInt(elem.dataset.fakerRecords, 10) ) {
				const elements = document.querySelectorAll(`[data-faker-recordset="${elem.getAttribute('data-faker-recordset')}"]`);
				if ( elements.length > parseInt(elem.dataset.fakerRecords,10) ) {
					const lastElement = elements[elements.length - 1];
					lastElement.parentNode.removeChild(lastElement);
				}
			}
		}

	}

	_loadData() {

		this.loadElements(this.element,false)

	}

	loadElements(root,force=false) {
		const attributeList = ["data-faker-html", "data-faker-value", "data-faker-text", "data-faker-attribute"];
		const selector = attributeList.map(attr => `[${attr}]`).join(',');

		const elements = Array.from(root.querySelectorAll(selector));
		
		elements.forEach(elem => {
			this.loadElement(elem,force);
		});

	}

	loadElement(elem,force=false) {
		// Make sure element does not have a data-faker-loaded attribute of false
		if ( elem.dataset.fakerLoaded === "false" && !force ) {
			return;
		}

		//If element has a data-faker-html attribute, we will use that to set the innerHTML of the element.
		if (
			elem.dataset.fakerHtml
			&&
			( force || !elem.innerHTML.length)
		) {
			this._applyData(elem, "innerHTML", elem.dataset.fakerHtml);
		}

		//If element has a data-faker-text attribute, we will use that to set the innerText of the element.
		if (
			elem.dataset.fakerText
			&&
			( force || !elem.innerText.length )
		) {
			this._applyData(elem, "innerText", elem.dataset.fakerText);
		}

		//If element has a data-faker-value attribute, we will use that to set the value of the element.
		if (
			elem.dataset.fakerValue
			&&
			( force || !elem.value.length )
		) {
			this._applyData(elem, "value", elem.dataset.fakerValue);
		}
	
		//If element has a data-faker-value attribute, we will use that to set the value of the element.
		if ( elem.dataset.fakerAttribute ) {
			this._setAttributes(elem, elem.dataset.fakerAttribute,force);
		}

	}

	_applyData(elem, part, key) {
		const value = this._getFakeValue(key);

		elem[part] = value;

	}

	_getFakeValue(key) {
		const [name, ...argsParts] = key.split(':');
		const qs = argsParts.length ? argsParts.join(':') : undefined;
		const args = this.queryStringToObject(qs);
		
		if ( key ) {
			let fakerMethod = this._getFakerMethod( name );

			if ( typeof fakerMethod === 'function' ) {
				return fakerMethod(args);
			} else {
				console.error(`Faker method is not a function: ${key}`);
			}
		}
	}


	_getFakerMethod(value) {
		const methodPath = value.split('.');
		let fakerMethod = faker;
		methodPath.forEach(part => {
			if (fakerMethod[part]) {
				fakerMethod = fakerMethod[part];
			} else {
				console.error(`Invalid faker method path: ${methodPath}`);
				return null;
			}
		});
		return fakerMethod;
	}

	_loadFaker() {

		if ( this.element.dataset.fakerLocale ) {
			faker.locale = config.locale;
		}
		if ( this.element.dataset.fakerSeed ) {
			faker.seed(config.seed);
		}

		this.dispatch("fakerloaded", { detail: this.faker });

	}

	queryStringToObject(queryString) {
		const params = new URLSearchParams(queryString);
		const result = {};
		for ( const [key, value] of params.entries() ) {
		  result[key] = value;
		}

		return result;
	  }

	_setAttributes(elem, value,force=false) {
		const aAttributes = value.split(';');
		
		aAttributes.forEach(attr => {
			//If element has a data-faker-attribute attribute, we will use that to set the value of the element.
			//We will split the attribute and value by the first fat arrow, so we can use the rest of the string as the value.
			const [attribute, ...valueParts] = attr.split('=>');
			const key = valueParts.join(':');
			
			//If the attribute is missing or empty, set the attribute of the element to the value.
			if ( force || !elem.hasAttribute(attribute) ) {
				elem.setAttribute(attribute, this._getFakeValue(key));
			}
		});
	}

	_setMutationObservers() {

		this.mutationObservers = {};

		this.mutationObservers.records = new MutationObserver(() => {
			//console.log("Records changed");
			this._createRecords();
		})
		this.mutationObservers.atts = new MutationObserver((mutations) => {

				mutations.forEach(mutation => {
					//console.log("Mutation detected: ", mutation);
					if (!['data-faker-html', 'data-faker-text', 'data-faker-value', 'data-faker-attribute'].includes(mutation.attributeName)) {
						return;
					}
					console.log(`Attribute '${mutation.attributeName}' changed on`, mutation.target);
					console.log(`Old value: ${mutation.oldValue}`);
					console.log(`New value: ${mutation.target.getAttribute(mutation.attributeName)}`);
				});

		})
		
		// If the content is changed, we need to recreate the data.
		this.mutationObservers.atts.observe(
			this.element,
			{
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ['data-faker-html', 'data-faker-text', 'data-faker-value', 'data-faker-attribute']
			}
		);

		this.mutationObservers.records.observe(
			this.element,
			{
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ['data-faker-records']
			}
		);

	}

})

