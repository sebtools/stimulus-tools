/*
Courier Controller

This controller allows data to be copied from one element to another.
The source element is the element that contains the data to be copied.
The source element can be an input, textarea, select, or any element with a value attribute.

The target element is the element that will receive the data.
The target element can be any element with a value attribute or innerHTML.

The controller can be used in two ways:


1. As a standalone controller that listens for events and copies data from sources to targets.

In this case, use data-action="courier#transmit" on the source element and data-courier-target="source" on the target element.

Example:
<div data-controller="courier">
	<input type="text" id="foo" data-courier-target="source" data-target-id="bar" data-action="courier#transmit">
</div>

<div id="bar"></div>

In this example, the value of the input element with the id "foo" will be copied to the div element with the id "bar".


2. As a data controller that copies data from a source to a target when a specific event is triggered.

In this case, use data-courier-event="event-name" on the controller element.

Example:
<div data-controller="courier" data-courier-event="custom-event">
	<div id="foo" data-courier-target="target" data-source-id="bar"></div>
</div>

<input type="text" id="foo">

When the custom-event is triggered, the controller will copy data from the source to the target.

ToDo:
- Update documentation
- Debounce the update method to prevent multiple calls in quick succession.
*/

application.register('courier', class extends Stimulus.Controller {
	static targets = ["source","target"];

	initialize() {
		this.dispatch("initialized");
	}

	connect() {
		this.setUpAttributes();
		this.setUpInitialValue();

		const method = this.update.bind(this);

		//Set up event listeners
		if ( this.element.dataset.courierEvent ) {
			const events = this.element.dataset.courierEvent.split(" ");
			events.forEach(event => {
				window.addEventListener(event, method);
			});
		}

		window.addEventListener("courier:update", method);

		this.loadMutationObserver();

		this.runOnloads();

		this.dispatch("connected");
  	}

	disconnect() {
		const method = this.update.bind(this);
		
		//Remove event listeners
		if ( this.element.dataset.courierEvent ) {
			const events = this.element.dataset.courierEvent.split(" ");
			events.forEach(event => {
				window.removeEventListener(event, method);
			});
		}

		this.observer.disconnect();
		window.removeEventListener("courier:update", method);

		this.dispatch("disconnected");
  	}

	runOnload(elem) {
		this.send(elem);
	}

	runOnloads() {
		//Run the transmit method of any element with both data-courier-target="source" data-courier-onload="true" attributes
		const sources = this.element.querySelectorAll("[data-courier-target='source'][data-courier-onload='true']");
		sources.forEach(source => {
			this.runOnload(source);
		});
	}

	setUpAttributes() {
		//Any element with either a data-courier-path or data-courier-target attribute should have a data-courier-target attribute of "source".
		const elements = this.element.querySelectorAll("[data-courier-path], [data-courier-target]");
		elements.forEach(element => {
			if ( !element.dataset.courierTarget ) {
				element.dataset.courierTarget = "source";
			}
		});

		//Any element with a data-courier-target attribute of "source" should have a data-action attribute of "courier#transmit".
		const sources = this.element.querySelectorAll("[data-courier-target='source']");
		sources.forEach(source => {
			if ( !source.dataset.action ) {
				source.dataset.action = "courier#transmit";
			}
		});

		//Any element with a data-courier-target attribute of "source" should have a data-courier-onload attribute of "true".
		sources.forEach(source => {
			if ( !source.dataset.courierOnload ) {
				source.dataset.courierOnload = "true";
			}
		});

	}

	setUpInitialValue() {
		const sources = this.element.querySelectorAll("[data-courier-target='source']");

		sources.forEach(source => {
			
			if (
				source.tagName == "SELECT"
				&&
				!( source.selectedIndex > 0 )
			) {
				let targets = this.getTargetTargets(source);

				//If there is just one target, copy the value from the target to the source to start
				if ( targets.length == 1 ) {
					let target = targets[0];
					let value;
					if ( source.dataset.courierAttribute ) {
						value = target.getAttribute(source.dataset.courierAttribute);
					} else {
						value = target.hasAttribute('value') ? target.getAttribute('value') : target.hasAttribute('data-value') ? target.getAttribute('data-value') : target.innerHTML;
					}
					if ( value ) {
						value = value.trim();
						this.setValue(source, value);
					}
				}

			}

		});

		/*
		//Get value from value attribute, data-value attribute or innerHTML
		let value = source.value || source.dataset.value || source.innerHTML;

		//If the source element has a data-courier-attribute attribute, use that as the attribute name to set the value on the target element.
		if ( source.dataset.courierAttribute ) {
			target.setAttribute(source.dataset.courierAttribute,value);
		} else {
			this.setValue(target, value)
		}
		*/
	}
	
	getTargetTargets(elem) {
		let aResults = [];

		if ( elem.dataset.targetId ) {
			const target = document.getElementById(elem.dataset.targetId);
			if ( target ) {
				return [target];
			}
		}

		const path = elem.dataset.courierPath.split(".");
		path.forEach(p => {
			const targets = document.querySelectorAll(p);
			if ( targets.length > 0 ) {
				targets.forEach(target => {
					aResults.push(target);
				});
			}
		});

		return aResults;
		
	}

	send(elem) {

		//Only take action if the element is defined as a source or target
		if ( ! elem.dataset.courierTarget ) return;

		//If the element is a source, copy its value to the target
		if ( elem.dataset.courierTarget == "source" ) {
			const targets = this.getTargetTargets(elem);
			if ( targets.length > 0 ) {
				targets.forEach(target => {
					this.copy(elem, target);
				});
			}
		}

		//If the element is a target, copy the value from the source
		if ( elem.dataset.courierTarget == "target" && elem.dataset.sourceId ) {
			const source = document.getElementById(elem.dataset.sourceId);
			if ( source ) {
				this.copy(source,elem);
			}
		}

	}

	//Transmit data from source to target
	transmit(event) {
		const elem = event.currentTarget;

		this.send(elem);

	}

	//Update all targets with values from sources
	update() {

		//Update targets with values from sources
		this.targetTargets.forEach(target => {
			const sourceId = target.dataset.sourceId;
			if (!sourceId) return;
			
			const source = document.getElementById(sourceId);
			if (!source) return;
			
			this.copy(source,target);
		});

		//Update sources with values from targets
		this.sourceTargets.forEach(source => {
			const targetID = source.dataset.targetId;
			if (!targetID) return;
			
			const target = document.getElementById(targetID);
			if (!target) return;
			
			this.copy(source,target);
		});

	}

	//Copy value from source to target
	copy(source,target) {
		//Get value from value attribute, data-value attribute or innerHTML
		//let value = source.value || source.dataset.value || source.innerHTML;
		let value = this.getValue(source);
		console.log("Value: ", value);

		//If the source element has a data-courier-attribute attribute, use that as the attribute name to set the value on the target element.
		if ( source.dataset.courierAttribute ) {
			target.setAttribute(source.dataset.courierAttribute,value);
		} else {
			this.setValue(target, value)
		}

		this.dispatch("copied", { detail: { source: source, target: target } });
		
	}

	getValue(elem) {

		if ( elem.value !== undefined ) {
			return elem.value;
		}

		if ( elem.hasAttribute('value') ) {
			return elem.value;
		}
		if ( elem.hasAttribute('data-value') ) {
			return elem.dataset.value;
		}
		if ( elem.tagName == "SELECT" && elem.selectedIndex > -1 ) {
			return elem.options[elem.selectedIndex].value;
		}
		
		return elem.innerHTML;
	}

	//Set value of target
	setValue(target, value) {
		if ( target.tagName == "SELECT" ) {
			//Select the option with the value of the target
			let options = target.querySelectorAll("option");
			options.forEach(option => {
				if ( option.value == value ) {
					option.selected = true;
				}
			});
		} else if ( target.value !== undefined ) {
			target.value = value;
		} else if ( target.hasAttribute('value') ) {
			target.value = value;
		} else if (target.dataset.value !== undefined) {
			target.dataset.value = value;
		} else {
			target.innerHTML = value;
		}
	}


	loadMutationObserver() {
		this.observer = new MutationObserver(
			//Call this.send() and pass in the element that changed.
			(mutations) => {
				mutations.forEach(mutation => {
					console.log("Mutation detected: ", mutation);
					this.setUpInitialValue();
					this.send(mutation.target);
				});
			}
		);

		//Watch for changes to any element with a data-courier-target="source" attribute. Limit changes to the innerHTML or the value attribute.
		const sourceTargets = this.element.querySelectorAll("[data-courier-target='source']");
		sourceTargets.forEach(source => {
			/*
				//Observe innrHTML changes to the source element
				this.observer.observe(
					source,
					{ characterData: true }
				);
			*/
			//Observe value changes to the source element
			this.observer.observe(
				source,
				{ attributes: true, attributeFilter: ["value","data-value"] }
			);
		});

	}

})