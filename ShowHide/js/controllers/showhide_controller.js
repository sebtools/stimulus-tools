const oShowHideUtil = {
	findKeysInString(str, obj) {
		const keys = Object.keys(obj);
		const aKeys = [];

		keys.forEach(key => {
			if (str.includes(key)) {
				aKeys.push(key);
			}
		});

		return aKeys;
	},


	//Get form elements. 
	getFormElems(parent) {
		var aTags = ["input","select","textarea","button","datalist"];
		var aResults = [];

		for ( var tag of aTags ) {
			var aElems = parent.getElementsByTagName(tag);
			for ( var elem of aElems ) {
				if ( elem.hasAttribute('name') ) {
					aResults.push(elem);
				}
			}
		}

		return aResults;
	},

	getOperator(pair) {
		const aKeys = oShowHideUtil.removeSubstringKeys(oShowHideUtil.findKeysInString(pair,oShowHideUtil.getOperators()));

		if ( aKeys.length == 1 ) {
			return aKeys[0];
		} else if ( aKeys.length == 0 ) {
			return "";
		} else {
			console.table(aKeys);
			console.error("Multiple operators in pair.");
		}
	},

	getOperators() {
		var oResult = {
			"=":"Exact Match of:",
			"+=":"All of:",
			"-=":"None of:",
			"|=":"Any of"
		};

		for ( var key in oResult ) {
			oResult["!" + key] = "Not: " + oResult[key];
		}

		/*
		*Possible* later additions
			"+!=":"Everything except:",
			"-!=":"Nothing except",
		*/

		return oResult;
	},

	getPairParts(pair) {
		var operator = oShowHideUtil.getOperator(pair);
		var oResult = {"operator":operator};

		if ( operator.length ) {
			var aParts = oShowHideUtil.splitByArbitraryString(pair,operator);
			oResult["name"] = aParts[0].toLowerCase();
			oResult["value"] = aParts[1].split(",");
		} else {
			oResult["name"] = pair.toLowerCase();
			oResult["value"] = [];
		}

		return oResult;
	},

	removeSubstringKeys(array) {
		// Iterate through each key
		for (let i = 0; i < array.length; i++) {
			for (let j = 0; j < array.length; j++) {
				// Skip comparing the key to itself
				if (i !== j) {
					// If array[i] is a substring of array[j], remove it
					if (array[j].includes(array[i])) {
						array.splice(i, 1);
						// Decrement i since array shifted left by splice operation
						i--;
						// Break inner loop since we found a match and removed an element
						break;
					}
				}
			}
		}
		return array;
	},

	splitByArbitraryString(str, delimiter) {
		if (!delimiter || typeof delimiter !== 'string') {
			throw new Error('Delimiter must be a non-empty string');
		}

		const result = [];
		let currentIndex = 0;
		let delimiterIndex;

		while ((delimiterIndex = str.indexOf(delimiter, currentIndex)) !== -1) {
			result.push(str.substring(currentIndex, delimiterIndex));
			currentIndex = delimiterIndex + delimiter.length;
		}

		if (currentIndex < str.length) {
			result.push(str.substring(currentIndex));
		}

		return result;
	}
}

// Original: https://blog.corsego.com/stimulus-display-show-hide-div-based-on-value

application.register('showhide', class extends Stimulus.Controller {
	static requires = [ "eraser" ]

	initialize() {
		this.dispatch("initialized");
	}

	connect() {

		this.begin();

		this.reveal();

		this.config();

		this.dispatch("connected");

	}

	disconnect() {
		this.dispatch("disconnected");
	}

	config() {

		this.addActions();

	}

	begin() {

		var aElems = this.element.querySelectorAll("[data-showhide-show],[data-showhide-hide]");

		for ( var elem of aElems ) {
			//If there is a show condition, but no hide condition, hide by default.
			if ( elem.hasAttribute("data-showhide-show") && !elem.hasAttribute("data-showhide-hide") ) {
				elem.hidden = true;
			}
		}

	}

	reveal() {
		var aElems = this.element.querySelectorAll("[data-showhide-show],[data-showhide-hide]");

		for ( var elem of aElems ) {
			var doShow = this._showhide(elem,"show");
			var doHide = this._showhide(elem,"hide");
			var action = "";

			//Only take action if one and only one of doHide and soShow are boolean
			if ( this._xorBoolean(doShow,doHide) ) {
				if ( typeof doShow == "boolean" ) {
					elem.hidden = !doShow;
					action = doShow ? "show" : "hide";
					this.dispatch("acted", { detail: { element: elem, show: doShow } });
				}
				if ( typeof doHide == "boolean" ) {
					elem.hidden = doHide;
					action = doHide ? "hide" : "show";
					this.dispatch("acted", { detail: { element: elem, hide: doHide } });
				}
			}
		}

	}

	// Add actions to any form fields referenced in show/hide attributes
	addActions() {
		var aElems = this._getFormElems();
		var aNames = this._getSourceNames();
		var name = "";

		//Look for each referenced name.
		for ( name of aNames) {
			//Look at each form element
			for ( var elem of aElems ) {
				//Case-insensitive name match
				if ( elem.getAttribute('name').toLowerCase() === name.toLowerCase()) {
					
					if ( elem.hasAttribute("data-action") ) {
						// Append showhide#reveal if it doesn't exist.
						if ( elem.getAttribute("data-action").indexOf("showhide#reveal") == -1 ) {
							elem.setAttribute("data-action", elem.getAttribute("data-action") + " showhide#reveal");
						}
					} else {
						elem.setAttribute("data-action","showhide#reveal");
					}
					
				}
			}
		}
	}

	//Get form elements. 
	_getFormElems() {
		/*
		We could use form.elements here, but this method means that we don't need a form element on the page.
		More importantly the form element might be *outside* of this.element and we need to limit our scope to elements in the controller.
		*/

		return oShowHideUtil.getFormElems(this.element);
	}

	_showhide(elem,showhide) {
		var attname = "data-showhide-" + showhide;
		var join = "and";
		
		if ( !elem.hasAttribute(attname) ) {
			return;
		}

		if ( elem.hasAttribute("data-showhide-join") && elem.getAttribute("data-showhide-join").toLowerCase() == "or"  ) {
			join = "or";
		}

		var aPairs = elem.getAttribute(attname).split("&");
		var result = true;
		if ( join == "or" ) {
			result = false;
		}
		for ( var pair of aPairs ) {
			var pair_result = this._hasPair(pair);

			if ( join == "or" ) {
				result = ( result || pair_result );
			} else {
				result = ( result && pair_result );	
			}
			
		}

		return result;
	}

	_getSourceNames() {
		var atts = "data-showhide-show,data-showhide-hide";
		var aElems = this.element.querySelectorAll('[data-showhide-show],[data-showhide-hide]');
		var aNames = [];

		//Each element with a show/hide attribute
		for ( var elem of aElems) {
			//Each show/hide attribute of the element
			for ( var att of atts.split(",") ) {
				if ( elem.hasAttribute(att) ) {
					var attvalue = elem.getAttribute(att);
					//Each name/value pair in the attribute
					for ( var pair of attvalue.split("&") ) {
						//Add name to array if it isn't already there.
						var name = oShowHideUtil.getPairParts(pair)["name"];
						if ( !aNames.includes(name) ) {
							aNames.push(name.toLowerCase());
						}
					}
				}
				
			}
		}
		
		return aNames;
	}

	_hasPair(pair) {
		var oPair = oShowHideUtil.getPairParts(pair);
		var oSource = this.element.querySelector('[name="' + oPair.name + '" i]');

		return this._hasValue(oSource,oPair.value,oPair.operator);
	}

	_hasValue(elem,aExpected,operator) {
		
		//If element doesn't exist, it doesn't count
		if ( !elem ) {
			return false;
		}
		
		var aTexts = this._text(elem);
		var aValues = this._val(elem);

		return this.__hasValue(aExpected,operator,aTexts,aValues);
	}

	__hasValue(aExpected,operator,aTexts,aValues) {

		//For negation, negate the call to the same function without the negation.
		if ( operator.charAt(0) == "!" ) {
			return !this.__hasValue(aExpected,operator.slice(1),aTexts,aValues);
		}

		var hasAnyValue = function() {
			return Boolean(
				( aTexts.length && aTexts[0].length )
				||
				( aValues.length && aValues[0].length )
			);
		}
		var hasAnyExpected = function() {
			for ( var value of aExpected ) {
				if ( aTexts.includes(value) || aValues.includes(value) ) {
					return true;
				}
			}
			return false;
		}
		var hasAnyNotExpected = function() {
			for ( var ii in aTexts ) {
				if ( !(aExpected.includes(aTexts[ii]) || aExpected.includes(aTexts[ii]) ) ) {
					return true;
				}
			}
			return false;
		}
		var hasAllExpected = function() {
			for ( var value of aExpected ) {
				if ( !(aTexts.includes(value) || aValues.includes(value) ) ) {
					return false;
				}
			}
			return hasAnyValue();
		}
		/*
		var hasAllNotExpected = function() {
			for ( var ii in aTexts ) {
				if ( (aExpected.includes(aTexts[ii]) || aExpected.includes(aTexts[ii]) ) ) {
					return false;
				}
			}
			return hasAnyValue();
		}
		*/

		switch(operator) {
			case "":
				//Empty operator means that any value at all counts.
				return hasAnyValue();
			break;
			case "=":
				return (
					hasAllExpected()
					&&
					!hasAnyNotExpected()
				);
			break;
			case "+=":
				//At least
				return hasAllExpected();
			case "-=":
				//None of
				return !hasAnyExpected();
			break;
			case "|=":
				//Any of
				return hasAnyExpected();
			break;
			/*
			case "-!=":
				//Nothing Except
				return (
					hasAnyNotExpected()
					&&
					!hasAnyExpected()
				);
			break
			case "+!=":
				//Everything except
				return (
					hasAllNotExpected()
					&&
					!hasAnyExpected()
				);
			*/
			default:
				return false;
		}
	}
	
	_get(elem,type) {
		switch( elem.tagName.toLowerCase() ) {
			case "input":
				switch ( elem.type ) {
					case "checkbox":
					case "radio":
						var aResult = [];
						var aChecked = this.element.querySelectorAll('input[name='+ elem.name +']:checked');

						for ( var checked of aChecked ) {
							//Try to get text from label
							if ( checked.id ) {
								var label = this.element.querySelector('label[for=' + checked.id + ']');
							}
							
							if (
								type == "text"
								&&
								label
							) {
								aResult.push(label.textContent.trim());
							} else {
								aResult.push(checked.value.trim());
							}
								
						}

						return aResult;
					break;
					default:
						return [elem.value];
				}
				
			break;
			case "select":
				if ( type == "text" ) {
					return [elem[elem.selectedIndex].text.trim()];
				} else {
					return [elem[elem.selectedIndex].value.trim()];
				}
				
			break;
			default:
				if ( elem.hasAttribute("value") ) {
					return [elem.value.trim()];
				} else {
					return [elem.textContent.trim()];
				}
		}
	}
	
	_text(elem) {
		
		return this._get(elem,"text");
	}
	
	_val(elem) {
		
		return this._get(elem,"value");
	}

	_xor(a,b) {
		return ( a || b ) && !( a && b );
	}

	_xorBoolean(a,b) {
		return this._xor(
			(typeof a == "boolean"),
			(typeof b == "boolean")
		);
	}

});