/*
This is a Stimulus controller that manages options for a select element.
It can be used to populate a select element with options from a data source, such as a table or a list.
It can also be used to set up a datalist element with options from a data source.
It can be used to set up a datalist element with options from a data source.

ToDo:
- Add support for multiple targets with the same controller
- Use dt/dd as value/label for dl/dt/dd
*/

application.register('options', class extends Stimulus.Controller {
	static targets = [];

	initialize() {

		this.dispatch("initialized");

	}

	connect() {

		this.config();

		//Attaching controller to object so we can call methods on it.
		this.element["o_" + this.identifier] = this;

		this.dispatch("connected");

	}

	disconnect() {

		// Remove the mutation observer when the controller is disconnected
		if ( this.mutationObserver ) {
			this.mutationObserver.disconnect();
		}

		this.dispatch("disconnected");

	}

	config() {

		//If the data-options-source attribute is set but not the selector, set the selector from the source
		if ( this.element.hasAttribute("data-options-source") && !this.element.hasAttribute("data-options-selector") ) {
			let selector = this.getSelector();
			if ( selector ) {
				this.element.setAttribute("data-options-selector", selector);
			}
		}

		if ( this.element.hasAttribute("data-options-selector") ) {
			//let aArray = this._getArray();
			//console.table(aArray);
			this.setOptions()
		}

		//Set up Mutation observer to watch for changes to the source element
		//Important to do this *after* the options are set, otherwise it will trigger a change event and set the options again
		this._setMutationObserver();

	}

	busy(isBusy) {
		this.element.ariaBusy = isBusy;
	}

	getOptions() {

		return this._getArray();
	}

	getOptionsTagName(target) {
		//Get the child element based on the tag name of the target
		switch ( target.tagName ) {
			case "DATALIST":
				return "option";
			case "SELECT":
				return "option";
			case "UL":
				return "li";
			case "OL":
				return "li";
			case "DL":
				return "dt";
			case "DT":
				return "dd";
			case "TABLE":
				return "tr";
			default:
				return null;
		}
	}

	getSelector() {
		let sourceSelector = this.element.getAttribute("data-options-source");
		if ( sourceSelector ) {
			let oSource = document.querySelector(this.element.getAttribute("data-options-source"));

			// If the source element is not found, log an error and return null
			if ( !oSource ) {
				console.warn(`Source element not found for selector: ${sourceSelector}`);
				return null;
			}

			// Get the selector for the child element based on the tag name of the source element
			switch ( oSource.tagName ) {
				case "SELECT":
					return `${sourceSelector} option`;
				case "UL":
					return `${sourceSelector} li`;
				case "OL":
					return `${sourceSelector} li`;
				case "DL":
					return `${sourceSelector} dt`;
				case "DT":
					return `${sourceSelector} dd`;
				case "TABLE":

					//Throw an error if data-options-colnum is not set as an integer
					if (
						!(
							this.element.hasAttribute("data-options-colnum")
							&&
							!isNaN(this.element.getAttribute("data-options-colnum"))
						)
					) {
						console.error(`If data-options-colnum is not set as an integer for selector: ${sourceSelector}`);
						return null;
					}
					//"table#ed tr td:nth-child(4)";
					return sourceSelector + " tbody tr td:nth-child(" + this.element.getAttribute("data-options-colnum") + ")";
				case "THEAD":
					return `${sourceSelector} th`;
				default:
					console.error(`Unable to determine select tag name: ${oSource.tagName}. Please add data-options-selector to the element.`);
					return null;
			}
		}
	}

	setOptions() {
		let aOptions = this.getOptions();
		let oTarget = this.element;
		let tagName = this.getOptionsTagName(oTarget);

		if ( oTarget && tagName ) {
			this.busy(true);

			//Get the current value of the selected element
			let currentValue = oTarget.value || oTarget.getAttribute("data-value") || oTarget.getAttribute("value");

			oTarget.innerHTML = ""; // Clear existing options

			// If the element is a select, add a default option
			if ( oTarget.tagName === "SELECT" ) {
				let oDefaultOption = document.createElement(tagName);
				oDefaultOption.value = "";
				oDefaultOption.textContent = this.element.getAttribute("placeholder") || this.element.getAttribute("data-placeholder") || this.element.getAttribute("data-options-default") || "Select an option";
				//If the textContent is not empty, but is not in parens, put it in parens
				if ( oDefaultOption.textContent && !oDefaultOption.textContent.includes("(") && !oTarget.querySelector(`option[value="${oDefaultOption.value}"]`) ) {
					oDefaultOption.textContent = `(${oDefaultOption.textContent})`;
				}
				oTarget.appendChild(oDefaultOption);
			}
			
			if ( oTarget.tagName === "TABLE" ) {

				
				//Add a thead
				let oThead = document.createElement("thead");

				let oHeadRow = document.createElement("tr");
				oThead.appendChild(oHeadRow);

				//Add a th for "Value"
				let oTHValue = document.createElement("th");
				oTHValue.textContent = "Value";
				oHeadRow.appendChild(oTHValue);

				//Add a th for "Label"
				let oTHLabel = document.createElement("th");
				oTHLabel.textContent = "Label";
				oHeadRow.appendChild(oTHLabel);

				//Add a th for "Attributes"
				let oTHAttributes = document.createElement("th");
				oTHAttributes.textContent = "Attributes";
				oHeadRow.appendChild(oTHAttributes);

				oThead.appendChild(oHeadRow);
				oTarget.appendChild(oThead);


				//Add a tbody
				let oTbody = document.createElement("tbody");
				oTarget.appendChild(oTbody);

				console.table(aOptions);
				
				aOptions.forEach(option => {
					let oRow = document.createElement("tr");
					let oValueCell = document.createElement("td");
					oValueCell.textContent = option.value;
					oRow.appendChild(oValueCell);

					let oLabelCell = document.createElement("td");
					oLabelCell.textContent = option.label;
					oRow.appendChild(oLabelCell);

					let oAttributesCell = document.createElement("td");
					//Add the attributes to the cell
					for ( let attr in option.attributes ) {
						let oAttr = document.createElement("dl");
						oAttr.innerHTML = `<dt>${attr}:</dt><dd>${option.attributes[attr]}</dd>`;
						oAttributesCell.appendChild(oAttr);
					}
					oRow.appendChild(oAttributesCell);

					oTbody.appendChild(oRow);
				});


			} else {

				aOptions.forEach(option => {
					let oOption = document.createElement(tagName);
					oOption.value = option.value;
					if ( tagName === "option" ) {
						oOption.textContent = option.label;
					} else {
						oOption.innerHTML = option.html || option.label;
					}

					// Set custom attributes
					for ( let attr in option.attributes ) {
						oOption.setAttribute(attr, option.attributes[attr]);
					}

					oTarget.appendChild(oOption);
				});

			}

			// If the element is a select, set the selected value to the current value
			if ( oTarget.tagName === "SELECT" ) {
				// Set the current value if it exists
				if ( aOptions.some(option => option.value === currentValue) ) {
					oTarget.value = currentValue;
				}
			}

			this.busy(false);
			this.dispatch("set", { detail: { options: aOptions } });
		}
	}

	_getObj(obj) {
		// If obj is a string, try to select the element
		if ( typeof obj === "string" ) {
			obj = document.querySelector(obj);
		}

		return obj;
	}

	_getArray() {
		let aObjects = document.querySelectorAll(this.element.getAttribute("data-options-selector"));
		let aArray = [];

		if ( aObjects.length > 0 ) {
			aArray = Array.from(aObjects).map(obj => {
				let oResult = {
					label:this._getLabel(obj),
					value:this._getValue(obj),
					text:obj.textContent.trim(),
					html:obj.innerHTML,
					attributes: {}
				};
				
				//If the data-options-attributes attribute is set, get the attributes
				if ( this.element.hasAttribute("data-options-attributes") ) {
					let aAttributes = this.element.getAttribute("data-options-attributes").split(",");
					//If the attribute is set to "*", get all attributes
					if ( aAttributes.includes("*") ) {
						// Get all attributes of the object
						let allAttributes = obj.attributes;
						for ( let ii=0; ii<allAttributes.length; ii++ ) {
							let attr = allAttributes[ii].name;
							if ( attr !== "value" && attr !== "data-value" && attr !== "data-label" ) {
								oResult.attributes[attr] = obj.getAttribute(attr);
							}
						}
					} else {
						aAttributes.forEach(attr => {
							attr = attr.trim();
							if ( obj.hasAttribute(attr) ) {
								oResult.attributes[attr] = obj.getAttribute(attr);
							}
						});
					}
				}

				return oResult;
			});
		}

		//If data-options-distinct is not false, make the array distinct
		if ( !(this.element.getAttribute("data-options-distinct") == "false") ) {
			aArray = this._makeDistinct(aArray);
		}

		//If the data-options-sort attribute is set, sort the array
		if ( this.element.hasAttribute("data-options-sort") ) {
			aArray = this._sortArray(aArray);
		}

		return aArray;
	}

	_getLabel(obj) {
		// If obj is a string, try to select the element
		if ( typeof obj === "string" ) {
			obj = document.querySelector(obj);
		}

		if ( !obj ) return null;

		//Return the text of the object
		return obj.textContent.trim() || obj.getAttribute("data-label") || obj.textContent || obj.innerHTML;
	}

	_getValue(obj) {
		// If obj is a string, try to select the element
		if ( typeof obj === "string" ) {
			obj = document.querySelector(obj);
		}

		if ( !obj ) return null;

		return obj.getAttribute("value") || obj.getAttribute("data-value") || obj.textContent || obj.innerHTML;
	}

	_makeDistinct(aArray) {
		let aDistinct = [];

		aArray.forEach(obj => {
			if ( !aDistinct.some(o => o.label === obj.label && o.value === obj.value) ) {
				aDistinct.push(obj);
			}
		});

		return aDistinct;
	}

	_sortArray(aArray) {
		const aSortInfo = this.element.getAttribute("data-options-sort").split(" ") || [];
		const sSortBy = aSortInfo[0] || "label";
		const sSortOrder = aSortInfo[1] || "asc";
		
		// Sort the array based on the specified property and order
		aArray.sort((a, b) => {
			let aValue = a[sSortBy] || a.label;
			let bValue = b[sSortBy] || b.label;

			if (sSortOrder === "asc") {
				return aValue.localeCompare(bValue);
			} else {
				return bValue.localeCompare(aValue);
			}
		});

		return aArray;
	}

	_setMutationObserver() {

		this.mutationObserver = new MutationObserver(() => {
			this.setOptions();
		});

		// If the attributes are changed, we need to update the options
		this.mutationObserver.observe(this.element, { attributes: true, attributeFilter: ['data-options-source', 'data-options-selector', 'data-options-attributes', 'data-options-sort', 'data-options-distinct'] });
		
		// If the source element is set, we need to observe it for changes
		if (  this.element.hasAttribute("data-options-source") ) {
			let oSource = document.querySelector(this.element.getAttribute("data-options-source"));
			if ( oSource ) {
				this.mutationObserver.observe(oSource, { attributes: false, childList: true, subtree: true });
			}
		}

		//We may need to observe something else, perhaps a parent element or a different element altogether
		//If the data-options-observe attribute is set, we need to observe it for changes
		if ( this.element.hasAttribute("data-options-observe") ) {
			let oObserve = document.querySelector(this.element.getAttribute("data-options-observe"));
			if ( oObserve ) {
				this.mutationObserver.observe(oObserve, { attributes: false, childList: true, subtree: true });
			}
		}

	}

})