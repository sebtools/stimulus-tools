const oSortTable = {
	oSortFuncs: {
		date: (a, b) => a.value - b.value,  // No need for Date conversion because it is in the runSort function
		dateDesc: (a, b) => b.value - a.value,
		number: (a, b) => a.value - b.value,
		numberDesc: (a, b) => b.value - a.value,
		string: (a, b) => a.value.localeCompare(b.value),
		stringDesc: (a, b) => b.value.localeCompare(a.value),
	},

	addCSS(css) {
		var head = document.getElementsByTagName('head')[0];
		var s = document.createElement('style');
		s.setAttribute('type', 'text/css');
		s.appendChild(document.createTextNode(css));
		head.appendChild(s);
	},

	camelCase(str) {
		// https://stackoverflow.com/a/6661012
		//return str.replace(/-([a-z])/g, function (g) { return g[1].toUpperCase(); });
		return str.replace(/-./g, c => c. substring(1).toUpperCase());
	},

	//I get the sort function for the type and direction
    getSortFunc(type, direction) {
        const key = `${type.toLowerCase()}${direction === "descending" ? "Desc" : ""}`;
        return this.oSortFuncs[key] || this.oSortFuncs.string;
    },

	runSort(array, sortType, sortDir) {
		// Preprocess values based on type
		if ( sortType === "number" ) {
			array.forEach(row => row.value = parseFloat(row.value) || 0);
		} else if ( sortType === "date" ) {
			array.forEach(row => row.value = new Date(row.value).getTime() || 0);
		} else {
			array.forEach(row => row.value = row.value.toLowerCase());
		}

		// Perform the sort
		array.sort(this.getSortFunc(sortType, sortDir));
	},

	getCellValue(td) {
		var result = "";
		var datas = td.getElementsByTagName("data");
		var inputs = td.getElementsByTagName("input");

		if ( td.hasAttribute("data-value") ) {
			result = td.getAttribute("data-value");
		} else if ( datas.length == 1 ) {
			result = datas[0].value;
		} else if ( td.textContent.length == 0 && inputs.length == 1 ) {
			if ( inputs[0].type == "checkbox" || inputs[0].type == "radio" ) {
				result = inputs[0].checked ? "1" : "0";
			} else {
				result = inputs[0].value;
			}
		} else {
			result = td.textContent;
		}

		result = result.trim();

		result = oSortTable.cleanCurrency(result);

		return result;
	},

	cleanCurrency(str) {

		if ( /^[$€£]?\s?\d{1,3}([,.\s]?\d{3})*(\.\d{2})?$/.test(str) ) {
			return str.replace(/[^0-9.]/g, ''); // Remove currency symbols and commas
		} else {
			return str; // Return original string if no match is found
		}
	}

};

application.register('tablesort', class extends Stimulus.Controller {
	static values = {
		autoHead: Boolean,
		rowsToCheck: { type: Number, default: 200 }
	}

	initialize() {
		/*
		Any actionable items in the tablesort controller should get a pointer hover.
		This is being added to the CSS in JavaScript for the following reasons:
			If the JavaScript isn't working than this CSS is hinting at behaviour that doesn't exist.
			Code using this controller should need to know to include it.
		*/
		var cssString = `
			[data-controller~="tablesort"] [data-tablesort-type]:hover {cursor: pointer;}
			[data-controller~="tablesort"] [data-tablesort-type="none" i]:hover {cursor: initial;}
		`;
		
		//Only apply a sort indicator if if the existing style sheet doesn't already have one.
		if ( !this._hasSortStyles() ) {
			//Make sure the table headers have a visual indicator of the sort order.
			cssString = cssString + `
			[data-controller~="tablesort"] th[aria-sort="ascending" i]::after {
				content: "\\25b2";
				font-size: 0.7em;
				padding-left: 3px;
				line-height: 0.7em;
			}
			
			[data-controller~="tablesort"] th[aria-sort="descending" i]::after {
				content: "\\25bc";
				font-size: 0.7em;
				padding-left: 3px;
				line-height: 0.7em;
			}
			`;
		}

		oSortTable.addCSS(cssString);

		this.dispatch("initialized");

	}

	connect() {

		this.config();

		//Attaching controller to object so we can call methods on it.
		this.element[this.identifier] = this;
		
		this.runWaitingCode(
			() =>  this.setUp()
		);

		this.dispatch("connected");

	}

	config() {
		const aParams = ["auto-head", "rows-to-check"];
		let oOptions = {};

		// Attempt to get options
		if ( this.element.dataset['tableSortOptions'] ) {
			try {
				oOptions = JSON.parse(this.element.dataset['tableSortOptions']);
			} catch (e) {
				console.error("Error parsing tableSortOptions:", e);
				return false;
			}
		}

		// Set options b -value attributes, attributes without the -value, and then from options.
		for ( const param of aParams ) {
			const camelParam = oSortTable.camelCase(param);
			const attrName = "data-tablesort-" + param + "-value";
			if ( !this.element.hasAttribute(attrName) ) {
				const datasetValue = this.element.dataset[oSortTable.camelCase("tablesort-" + param)];
				if ( datasetValue ) {
					this[camelParam + "Value"] = datasetValue;
				} else if ( oOptions[oSortTable.camelCase(param)] ) {
					this[camelParam + "Value"] = oOptions[camelParam];
				}
			}
		}

	}

	setUp() {
		// Make sure table has proper structure thead/tbody?
		this.setUpHeadBody();

		// Set up values for data cells
		this.setUpValues();

		// Set up column types
		this.setUpColTypes();

	}

	runWaitingCode(func) {
		this.busy(true);
		
		/*
		This makes sure that there is a tiny bit of idle time before executing this code and the false
		This allows the browser to paint any style on aria-busy="true".
		Without this, the browser doesn't get the opportunity to paint the change while it is processing - seeming unresponsive.
		(only matters for very large tables)
		*/
		setTimeout(() => {
			func();
			this.busy(false);
		}, 0);

	}

	disconnect() {
		
		delete this.element[this.identifier];

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

	sort(event) {

		// Get the column number being sorted
		var colIndex = this._getElemChildNum(event.currentTarget);

		this.sortByIndex(colIndex);

		this.dispatch("sorted");

	}

	sortByName(name) {
		var ths = this.element.querySelectorAll('th[data-tablesort-type]');

		//Find table header matching given string.
		for ( var ii=0; ii < ths.length; ii++ ) {
			var th = ths[ii];
			if ( name.toLowerCase() == th.textContent.toLowerCase() ) {
				//return;
				return this.sortByIndex(ii);
			}
		}

	}

	sortByIndex(colIndex) {

		this.runWaitingCode(
			() =>  this._sortByIndex(colIndex)
		);

	}

	_sortByIndex(colIndex) {
		var sortType = this._getColSortType(colIndex);// Get the sort type for the column
		
		// Take no action on sort type of "None" (data-action wouldn't be added for type of "none", but it could still be in the html)
		if ( sortType.toLowerCase() == "none" ) {
			return;
		}

		// Function to determine this so it can reverse
		var sortDir = this._getSortDir(colIndex);

		// Get array of values for column
		var aRows = this._getColumnCells(colIndex);

		// Sort array using sort type
		oSortTable.runSort(aRows, sortType, sortDir);

		// Ditch aria-sort from all columns
		this._removeAriaSorts();

		// Sort table rows from array
		this._applySortRows(aRows);

		// Use aria-sort to indicate sort order ( https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-sort )
		this.element.querySelectorAll('th')[colIndex].setAttribute("aria-sort",sortDir);

	}

	setUpHeadBody() {
		/*
			This change could break code relying on the structure of the table.
			So, we have a data-tablesort-auto-head="true" option so that the author can approve the change.
		*/

		var theads = this.element.getElementsByTagName('thead');

		//Only need to add a head if there isn't one already
		if ( !theads.length ) {
			
			if ( !this.autoHeadValue ) {
				throw new Error('Sort Table can only sort tables with a thead element. Please add one or add data-tablesort-auto-head="true" to the table and Data Sort will make the first row a thead.');
			}

			var trs = this.element.getElementsByTagName('tr');
			var thead_new = document.createElement("thead");

			if ( trs.length ) {

				//Put first row in head (figured I'd need to remove it from somewhere, but apparently not)
				thead_new.appendChild(trs[0]);
				
				//Add head to table
				this.element.insertBefore(thead_new, this.element.firstChild)
	
			}
			
		}

	}

	setUpColTypes() {
		var ths = this.element.querySelectorAll('th:not([data-tablesort-type]');

		//Mark are columns without a sort-type
		for (var ii = 0; ii < ths.length; ii++) {
			var th = ths[ii];
			//th.dataset.tablesortType = "string";
			th.dataset.tablesortType = this.guesColType(ii);// Attempt to determine type by data.
			
		}

		//Add missing actions
		var ths = this.element.querySelectorAll('th:not([data-action]');
		for ( const th of ths ) {
			// No action if sort type is None.
			if ( th.dataset.tablesortType.toLowerCase() != "none" ) {
				th.dataset.action = "click->tablesort#sort";
			}
		}

		//Add Aria Role
		var ths = this.element.querySelectorAll('th[data-action]');
		for ( const th of ths ) {
			// No action if sort type is None.
			if ( th.dataset.action.toLowerCase().includes("tablesort") ) {
				th.setAttribute("role","button");
			}
		}

		
	}

	setUpValues() {
		var tds = this.element.querySelector('tbody').querySelectorAll('td:not([data-tablesort-val])');
		
		// Set up MutationObserver to detect changes in table cells
		const observer = new MutationObserver((mutationsList) => {
			for ( const mutation of mutationsList ) {
				if ( mutation.type === 'attributes' || mutation.type === 'childList' ) {
					//Prevent infinite loop
					if ( mutation.attributeName === 'data-tablesort-val' ) {
						continue;
					}
					this.setUpValue(mutation.target);
				}
			}
		});
		
		//Setting up values for the cells.
		//This will make sorting faster later and allows the code that creates the table to manually indicate them instead.
		for ( const td of tds ) {
			this.setUpValue(td);
			
			//Make sure changes to values update the attribute
			observer.observe(td, { attributes: true, childList: true, subtree: false });
		}

		// Add event listener to detect changes in table cells
		this.element.querySelector('tbody').addEventListener('input', (event) => {
			console.log(event.target.tagName);
			if ( event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' ) {
				if ( event.target.parentNode.tagName === 'TD' ) {
					this.setUpValue(event.target.parentNode);
				}
			}
		});

	}

	setUpValue(td) {
		td.dataset.tablesortVal = oSortTable.getCellValue(td);
	}

	_applySortRows(aCells) {
		var new_tbody = document.createElement('tbody');
		var old_tbody = this.element.getElementsByTagName("tbody")[0];

		//Add the rows into the new tbody in the new order. Not visiable yet.
		for (  var ii in aCells ) {
			new_tbody.appendChild(aCells[ii].element);
		}
		
		//Replace the old tbody with the new one. Much faster that incrementally adding rows.
		old_tbody.parentNode.replaceChild(new_tbody, old_tbody);

	}

	//I formet the given date string as yyyy-mm-dd
	_formatDate(date) {//https://stackoverflow.com/a/23593099
		var d = new Date(date),
			month = '' + (d.getMonth() + 1),
			day = '' + d.getDate(),
			year = d.getFullYear();
	
		if ( month.length < 2 ) 
			month = '0' + month;
		if ( day.length < 2 ) 
			day = '0' + day;
	
		return [year, month, day].join('-');
	}

	//I get the column sort type for the given column index
	_getColSortType(index) {
		return this.element.querySelectorAll('th[data-tablesort-type]')[index].dataset.tablesortType;
	}

	_getColumnCells(columnIndex) {
		const table = this.element.querySelector("tbody");
		return Array.from(table.rows).map(row => {
			const cell = row.cells[columnIndex];
			return { value: cell.dataset.tablesortVal, element: row };
		});
	}

	// I get the number of child the given element is of its parent.
	_getElemChildNum(elem) {
		// Get the parent node of the element
		var parent = elem.parentNode;
		var childNumber = 0;

		// Loop through the children of the parent to find the position of the element
		for ( var i = 0; i < parent.children.length; i++ ) {
			if ( parent.children[i] === elem ) {
				return i;
				//childNumber = i + 1; // Add 1 to convert from zero-based index to child number
				//break;
			}
		}

	}

	_getSortDir(colIndex) {
		var sortDir = this.element.querySelectorAll('th')[colIndex].getAttribute("aria-sort");

		return ( sortDir == "ascending" ) ? "descending" : "ascending";
	}

	_hasSortStyles() {
		const oSample = document.createElement('th');
		oSample.setAttribute('aria-sort', 'ascending');
		document.body.appendChild(oSample);
		const hasStyle = ( window.getComputedStyle(oSample).cssText !== '' );
		document.body.removeChild(oSample);

		return hasStyle;
	}

	guesColType(colIndex) {
		var result = "";
		var table = this.element.getElementsByTagName("tbody")[0];
		var rowVal = 0;
		var numRowsToSearch = Math.min(table.rows.length,this.rowsToCheckValue);

		for ( var row = 0; row < numRowsToSearch; row++ ) {
			var td = table.rows[row].cells[colIndex];
			rowVal = td.dataset.tablesortVal;

			if ( rowVal.length ) {
				if ( rowVal.match(/^-?[£$¤]?[\d,.]+%?$/) ) {
					// result must be undecided or unchanged
					if ( result.length == 0 || result == "number" ) {
						result = "number";
					} else {
						result = "string";
					}
				} else if (
					rowVal.match(/^(\d\d?)[\/\.-](\d\d?)[\/\.-]((\d\d)?\d\d)$/)
				) {
					// result must be undecided or unchanged
					if ( result.length == 0 || result == "date" ) {
						result = "date";
					} else {
						result = "string";
					}
				} else {
					result = "string";
				}
				//As soon as we find something that is a string, we are done looking.
				if ( result == "string" ) {
					return result;
				}
			}
		}

		return result;
	  }

	_removeAriaSorts() {
		var ths = this.element.querySelectorAll('th');
		for ( const th of ths ) {
			th.removeAttribute("aria-sort");
		}
	}

})
