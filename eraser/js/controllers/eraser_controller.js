application.register('eraser', class extends Stimulus.Controller {

	initialize() {
		
		this.dispatch("initialized");

	}

	connect() {
		
		this.config();

		this.dispatch("connected");

	}

	disconnect() {

		this.dispatch("disconnected");

	}

	config() {
		var onAtt = "data-eraser-clearhidden-on";
		var actionAtt = "submit->eraser#clearHidden";

		let observer = new MutationObserver(
			(mutations) => this.mutationListener(mutations)
		);
		
		if ( this.element.hasAttribute(onAtt) ) {
			switch( this.element.getAttribute(onAtt).toLowerCase() ) {
				case "hide":
					observer.observe(
						this.element,
						{
							attributeFilter: ['hidden','style']
							,subtree: true
						}
					);
				break
				case "submit":
					if ( this.element.tagName.toLowerCase() != "form" ) {
						console.error(onAtt + ' value of "submit" can only be placed on a form.');
					}
					if ( this.element.hasAttribute("data-action") ) {
						//Prepend clear action to form if it isn't already there
						var action = this.element.getAttribute("data-action");
						if ( !action.includes(actionAtt) ) {
							this.element.setAttribute(
								"data-action",
								actionAtt + " " + action
							);
						}
					} else {
						//Simply set it if no data-action already exists
						this.element.setAttribute("data-action",actionAtt);
					}
				break;
				default:
					console.log('Valid values for ' + onAtt + ' are "hide" or "submit".')
				break;
			}
		}

	}

	//I listen for all style/hidden changes and hide all fields that are under something that has turned invisible.
	mutationListener(mutations) {
		for ( let mutation of mutations ) {
			if ( mutation.type === 'attributes' ) {
				//If this element is no invisible, hide it and all its child fields
				if ( !this.isElementVisible(mutation.target) ) {
					this.clearElement(mutation.target)
					this.clearScope(mutation.target);
				}
			}
		}
	}

	//I clear all elements in the given scope (element)
	clearScope(scope) {
		var aFields = this.getScopeFields(scope);

		for ( var elem of aFields ) {
			this.clearElement(elem);
		}
	}

	//I clear the given element
	clearElement(element) {
		switch( element.tagName.toLowerCase() ) {
			case "input":
				switch ( element.type ) {
					case "checkbox":
					case "radio":
						//If a default is selected then check that.
						if (
							element.parentElement
							&&
							element.parentElement.hasAttribute("data-default-value")
							&&
							element.parentElement.getAttribute("data-default-value") == element.value
						) {
							element.checked = true;
						} else {
							element.checked = false;
						}
					break;
					case "select":
						element.value = "";
						
						//Changing the select as above does not dispatch the change event, so kicking that off manually.
						var event = new Event('change', { bubbles: true });
						element.dispatchEvent(event);
						
						break;
					case "submit":
					case "button":
						//Do nothing.
					break;
					default:
						element.value = '';
				}
			break;
			case "select":
			case "textarea":
				element.value = '';
		}
		
		this.dispatch(
			"cleared",
			{
				target: element
			}
		);

	}

	clearAll() {
		var scope = this.element;

		if ( event && event.target ) {
			scope = event.target;
		}

		this.clearScope(scope);
		
	}

	//I clear all of the hidden elements in this controller.
	clearHidden(event) {
		var aElems = this.getHiddenFields(this.element);

		for ( var elem of aElems ) {
			this.clearElement(elem);
		}
		
	}

	//I clear all of the form fields in the given scope (element)
	getHiddenFields(scope) {
		var controller = this;
		var aResults = [];
	
		// Select all form fields
		var aFields = this.getScopeFields(scope);
	
		// Check each form field and its ancestors for visibility
		aFields.forEach(function(field) {
			var element = field;
			var isVisible = controller.isElementVisible(field);
	
			// If the field or any of its ancestors are hidden, add it to the list
			if ( !isVisible ) {
				aResults.push(field);
			}
		});
	
		return aResults;
	}

	//I get all of the form fields in the given scope (element)
	getScopeFields(scope) {
		return scope.querySelectorAll('input, select, textarea');
	}

	//I check to see if the given element is effectively visible (checking the hidden and style and then climbing the parent tree ddo the same)
	isElementVisible(element) {
	
		// Check if the field itself is hidden
		if ( element.hidden || element.style.display === 'none' || element.style.visibility === 'hidden' ) {
			return false;
		}

		// Check if any of the field's ancestors are hidden
		if ( element.parentElement ) {
			return this.isElementVisible(element.parentElement);
		}

		return true;
	}

});
