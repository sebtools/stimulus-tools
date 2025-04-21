
application.register('cloner', class extends Stimulus.Controller {
	static targets = [ "source", "button" ];
	static values = {
		action: { type: String, default: "button:beforebegin" },
		singlify: String,
		pattern: { type: String, default: "" },
		reset: { type: Boolean, default: true }
	}

	initialize() {
		this.dispatch("initialized");
	}

	connect() {

		this.config();

		this.makeCopies();

		this.dispatch("connected");

	}

	disconnect() {
		this.dispatch("disconnected");
	}

	config() {
		var oButton = this.buttonTarget;

		if ( oButton.hasAttribute("data-action") ) {
			//Append cloner#clone if it doesn't exist.
			if ( oButton.getAttribute("data-action").indexOf("cloner#clone") == -1 ) {
				oButton.setAttribute("data-action", oButton.getAttribute("data-action") + " cloner#clone");
			}

		} else {
			oButton.setAttribute("data-action","cloner#clone");
		}

		if ( this.element.hasAttribute("data-cloner-action") ) {
			this.actionValue = this.element.getAttribute("data-cloner-action");
		}
		if ( this.element.hasAttribute("data-cloner-singlify") ) {
			this.singlifyValue = this.element.getAttribute("data-cloner-singlify");
		}
		if ( this.element.hasAttribute("data-cloner-pattern") ) {
			this.patternValue = this.element.getAttribute("data-cloner-pattern");
		}
		if ( this.element.hasAttribute("data-cloner-reset") ) {
			this.resetValue = this.element.getAttribute("data-cloner-reset");
		}
		

	}

	makeCopies() {
		
		if ( this.element.hasAttribute("data-cloner-copies") ) {
			
			let copies = parseInt(this.element.getAttribute("data-cloner-copies"), 10);
			if ( copies > 1 ) {
				copies = copies - 1; // Subtract one because the first copy is already there
				for ( let ii=0; ii<copies; ii++) {
					this.clone();
				}
			}

		}

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

	clone() {
		var oButton = this.buttonTarget;
		var oSource = this.sourceTarget;
		var html = oSource.outerHTML;
		var oParent;
		var insertAction = "beforebegin";

		this.busy(true);

		// Replace all instances of "_1" followed by a word boundary with "_2"
		if ( this.patternValue.length ) {
			let regex = new RegExp(this.patternValue, "g")

			//html = html.replace(regex, "_2");
			//console.log('length: ' + this.sourceTargets.length + 1);
			html = this.replaceDigitsWithNumber(html,regex,this.sourceTargets.length + 1);
		}
		
		if ( this.actionValue.split(":").length == 2 ) {
			insertAction = this.actionValue.split(":")[1];
			if ( insertAction == "before" ) {
				insertAction = "beforebegin";
			}
			if ( insertAction == "after" ) {
				insertAction = "afterend";
			}
		}
		if ( this.actionValue.split(":")[0] == "source" ) {
			oParent = oSource;
		} else {
			oParent = oButton;
		}

		oParent.insertAdjacentHTML(insertAction, html);

		var inserted = this.sourceTargets[this.sourceTargets.length-1];

		//Just hiding the element while actions are taken
		inserted.hidden = true;

		if ( this.hasSinglifyValue && this.singlifyValue.length ) {
			this.singlify(inserted);
		}

		this.clear(inserted);

		if ( this.resetValue ) {
			this.resetContainer(inserted);
		}

		inserted.hidden = false;

		this.busy(false);

		this.dispatch(
			"cloned",
			{
				detail: {},
				target: inserted,
			}
		);
		
		//In case any other code needs to respond to the addition of this element.
		this.dispatch('load', {
			cancelable: false,
			detail:{},
			target: inserted,
		});
		
	}

	clear(element) {
		const clears = element.querySelectorAll('[data-cloner-clear]');

		// Clear the elements as indicated
		clears.forEach(elem => {
			const clears = elem.getAttribute('data-cloner-clear').split(',');

			clears.forEach(clear => {

				switch(clear) {
					case "value":
						elem.value = '';
						break;
					case "html":
						elem.innerHTML = '';
						break;
					case "text":
						elem.innerText = '';
						break;
					case "remove":
						elem.remove();
						break;
					case "hide":
						elem.hidden = true;
						break;
					default:
						elem.removeAttribute(clear);
						break;
				}

			});
		});

	}

	//Remove duplicates of the specified selector from the element.
	removeDuplicates(element, selector) {
		var elements = element.querySelectorAll(selector);
		var firstInstance = true;

		// Iterate through the elements
		for ( var i = 0; i < elements.length; i++ ) {
			var element = elements[i];
			
			// Check if it's the first instance of the class
			if ( firstInstance ) {
				firstInstance = false; // Set to false for subsequent instances
			} else {
				// If not the first instance, remove the element
				element.parentNode.removeChild(element);
			}
		}
	}

	//Replace the digits in the string with the specified number.
	replaceDigitsWithNumber(str, regex, number) {
		return str.replace(regex, function() {
			return arguments[1] + number;
		});
	}

	//Singlify the element by removing duplicates of the specified selector.
	singlify(element) {
		var selectors = '.counsel,[data-showhide-show="hasAlias_1=Yes"]>div';
		var aSelectors = selectors.split(",");

		for ( var selector of aSelectors ) {
			this.removeDuplicates(element, selector);
		}

	}

	resetContainer(container) {
		if (!container || !(container instanceof HTMLElement)) return;
		
		const elements = container.querySelectorAll('input, select, textarea');
		
		elements.forEach(elem => {
			const tag = elem.tagName.toLowerCase();
			const type = elem.type ? elem.type.toLowerCase() : '';

			if ( tag === 'select' ) {
				for ( let ii= 0; i<el.options.length; ii++ ) {
					el.options[ii].selected = el.options[ii].defaultSelected;
				}
			} else if ( tag === 'input' && ['checkbox', 'radio'].includes(type) ) {
				elem.checked = elem.defaultChecked;
			} else if ( tag === 'input' && type === 'file' ) {
				elem.value = null; // Reset file input
			} else {
				elem.value = ''; // Reset other input types
			}

		});
	}
	  

})