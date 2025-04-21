application.register('tablefilter', class extends Stimulus.Controller {
	static targets = ["filter","table"];

	initialize() {

		this.dispatch("initialized");

	}

	connect() {

		this.config();

		//Attaching controller to object so we can call methods on it.
		this.element[this.identifier] = this;
		
		this._runWaitingCode(
			() =>  this.setUp()
		);

		this.dispatch("connected");

	}

	disconnect() {

		this.dispatch("disconnected");

	}

	config() {
		//Make sure the table target is set
		if ( !this.hasTableTarget ) {
			if ( this.element.tagName.toLowerCase() === 'table' ) {
				//If the element is a table, then set it as the table target
				this.element.setAttribute('data-tablefilter-target', 'table');
			} else if ( this.element.querySelectorAll('table').length === 1 ) {
				//If there is only one table in the element, then set it as the table target
				this.element.querySelector('table').setAttribute('data-tablefilter-target', 'table');
			} else {
				//If there is no single table, then throw an error
				throw new Error('Table Filter requires a table target.');
			}

		}

	}

	setUp() {
		this._setUpTableHeadBody();
		this._setUpTableFilters();
		this._setUpFilterTargets();
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

	filter() {

		//Only run filter after 100 ms of no typing
		
		//Clear the filter timeout
		clearTimeout(this.filterTimeout);

		//Set the filter timeout
		this.filterTimeout = setTimeout(() => {
			this.dispatch("filtering");

			//Run the filter code
			this._runWaitingCode(
				() => this._filter()
			);

		}, this._getWaitTime());

	}

	getCellLabel(td) {
		var result = "";
		var inputs = td.getElementsByTagName("input");

		if ( td.textContent.length == 0 && inputs.length == 1 ) {
			result = inputs[0].value;
		} else {
			result = td.textContent;
		}

		result = result.trim();

		if ( typeof result !== 'string' ) {
			result = String(result);
		}

		return result;
	}

	getCellValue(td) {
		var result = "";
		var datas = td.getElementsByTagName("data");
		var inputs = td.getElementsByTagName("input");

		if ( td.hasAttribute("data-value") ) {
			result = td.getAttribute("data-value");
		} else if ( datas.length == 1 ) {
			result = datas[0].value;
		} else if ( td.textContent.length == 0 && inputs.length == 1 ) {
			result = inputs[0].value;
		} else {
			result = td.textContent;
		}

		result = result.trim();

		result = this._stripNumericCommas(result);

		if ( typeof result !== 'string' ) {
			result = String(result);
		}

		return result;
	}

	getColNameIndex(name) {
		let aNames = this.tableTarget.querySelectorAll('[data-tablefilter-colname]:not([data-tablefilter-target="filter"])');
		let result = -1;

		aNames.forEach((element, index) => {
			if ( element.getAttribute('data-tablefilter-colname') === name ) {
				result = element.cellIndex;
			}
		});

		return result;
	}

	getFilters() {
		var aFilterFields = this.element.querySelectorAll('[data-tablefilter-target="filter"]');
		var aFilters = [];
		aFilterFields.forEach(filter => {
			var oFilter = {};
			oFilter.value = filter.value;
			
			if ( filter.hasAttribute('data-tablefilter-colindex') ) {
				oFilter.colidx = parseInt(filter.getAttribute('data-tablefilter-colindex'));
			} else if ( filter.hasAttribute('data-tablefilter-colnum') ) {
				oFilter.colidx = parseInt(filter.getAttribute('data-tablefilter-colnum'));
				oFilter.colidx--; //Decrement by one to make it zero based
			} else if ( filter.hasAttribute('data-tablefilter-colname') ) {
				oFilter.colidx = this.getColNameIndex(filter.getAttribute('data-tablefilter-colname'));
			} else if ( filter.parentElement.cellIndex != undefined ) {
				oFilter.colidx = filter.parentElement.cellIndex;
			}
			
			//If the column index is not a valid column, then remove it
			if (
				oFilter.hasOwnProperty('colidx')
				&&
				(oFilter.colidx < 0 || oFilter.colidx >= this.tableTarget.rows[0].cells.length)
			) {
				delete oFilter.colidx;
			}

			if ( !oFilter.hasOwnProperty('colidx') ) {
				console.warn('Unable to determine column to sort for filter.');
			}

			aFilters.push(oFilter);
		});

		return aFilters;
	}

	//Private methods

	_filter() {
		
		//Get the filters
		var aFilters = this.getFilters();

		//Get the rows
		let rows = this.tableTarget.querySelectorAll('tbody tr');

		//Loop through the rows and hide the ones that don't match the filter
		rows.forEach(row => {
			let shouldHide = aFilters.some(filter => {
				//If the filter doesn't have a column index, then don't filter
				if ( !filter.hasOwnProperty('colidx') ) return false;

				let cell = row.cells[filter.colidx];
				//Hide the row if the cell doesn't match the filter (by value or by label)
				return (
					cell
					&&
					!this._matchesFilter(this.getCellLabel(cell), filter)
					&&
					!this._matchesFilter(this.getCellValue(cell), filter)
				);
			});
			//row.style.display = shouldHide ? 'none' : '';
			row.hidden = shouldHide;
		});

		this.dispatch("filtered");

	}

	//I get the filter additions for each column
	_getFilterAdditions() {
		var aColumns = this.tableTarget.getElementsByTagName('thead')[0].getElementsByTagName('th');
		var aFilterAdditions = [];
		var cols = this.tableTarget.getElementsByTagName('col');

		for ( var ii = 0; ii < aColumns.length; ii++ ) {
			var sFilterAddition = {};
			
			if ( aColumns[ii].hasAttribute('data-tablefilter-addfilter') ) {
				sFilterAddition.add = aColumns[ii].getAttribute('data-tablefilter-addfilter');
			} else if ( cols.length > ii && cols[ii].hasAttribute('data-tablefilter-addfilter') ) {
				sFilterAddition.add = cols[ii].getAttribute('data-tablefilter-addfilter');
			} else if( this.tableTarget.hasAttribute('data-tablefilter-addfilters') ) {
				sFilterAddition.add = this.tableTarget.getAttribute('data-tablefilter-addfilters');
			} else {
				sFilterAddition.add = !this.hasFilterTarget;
			}

			aFilterAdditions.push(sFilterAddition);
		}

		return aFilterAdditions;
	}

	//I get the wait time for the filter. The more rows, the longer the wait time because the sorting is slower.
	_getWaitTime() {
		const min = 50;
		const max = 200;
		const ratio = 250;
		var tbody = this.element.querySelector('tbody');
		if ( !tbody ) {
			tbody = this.element;
		}
		
		const rowCount = tbody.querySelectorAll('tr').length;
		
		return Math.max(min, Math.min(max, Math.ceil(rowCount / ratio)));
	}


	/**
	 * Determines if a cell value matches the filter condition.
	 * @param {string} cellValue - The value of the cell.
	 * @param {object} filter - The filter object containing value and optional operator.
	 * @returns {boolean} - Whether the cell value satisfies the filter condition.
	 */
	_matchesFilter(cellValue, filter) {
		let filterValue = filter.value.toLowerCase();
		let cellText = cellValue.toLowerCase();

		switch (filter.operator) {
			case 'blank':
				return cellText === '';
			case 'notBlank':
				return cellText !== '';
			case 'equals':
				return cellText === filterValue;
			case 'notEquals':
				return cellText !== filterValue;
			case 'startsWith':
				return cellText.startsWith(filterValue);
			case 'endsWith':
				return cellText.endsWith(filterValue);
			case 'greaterThan':
				return parseFloat(cellText) > parseFloat(filterValue);
			case 'lessThan':
				return parseFloat(cellText) < parseFloat(filterValue);
			case 'contains':
			default:
				return cellText.includes(filterValue);
		}
	}

	_runWaitingCode(func) {
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

	//I add a data-action to each filter target that doesn't already have one
	_setUpFilterTargets() {
		let aFilters = this.element.querySelectorAll('[data-tablefilter-target="filter"]');
		aFilters.forEach(filter => {
			if ( !filter.hasAttribute('data-action') ) {
				filter.setAttribute('data-action', 'tablefilter#filter');
			}
		});
	}

	//I add the filter inputs to the table
	_setUpTableFilters() {
		//If the table has data-tablefilter-addfilters="false" then don't add filters
		if (
			this.tableTarget.hasAttribute('data-tablefilter-addfilters')
			&&
			this.tableTarget.getAttribute('data-tablefilter-addfilters') === 'false'
		) {
			return;
		}

		//Get the columns and the filter additions
		let aFilterAdditions = this._getFilterAdditions();
		aFilterAdditions.forEach(filterAddition => {
			filterAddition.add = filterAddition.add === true;
		});
		let hasFilterAdditions = aFilterAdditions.some(filterAddition => filterAddition.add === true);

		//If there are any filters, then add a row to the table head
		if ( hasFilterAdditions ) {
			let tr = document.createElement('tr');
			aFilterAdditions.forEach(filterAddition => {
				let td = document.createElement('td');
				//Add a filter input for every column than needs one
				if ( filterAddition.add ) {
					let input = document.createElement('input');
					input.type = 'text';
					input.setAttribute('data-tablefilter-target', 'filter');
					td.appendChild(input);
				}
				tr.appendChild(td);
			});
			this.tableTarget.querySelector('thead').appendChild(tr);
		}
	}

	_setUpTableHeadBody() {
		/*
			This change could break code relying on the structure of the table.
			So, we have a data-sort-table-auto-head="true" option so that the author can approve the change.
		*/

		var theads = this.tableTarget.getElementsByTagName('thead');

		//Only need to add a head if there isn't one already
		if ( !theads.length ) {
			
			if ( !this.autoHeadValue ) {
				throw new Error('Sort Table can only sort tables with a thead element. Please add one or add data-sort-table-auto-head="true" to the table and Data Sort will make the first row a thead.');
			}

			var trs = this.tableTarget.getElementsByTagName('tr');
			var thead_new = document.createElement("thead");

			if ( trs.length ) {

				//Put first row in head (figured I'd need to remove it from somewhere, but apparently not)
				thead_new.appendChild(trs[0]);
				
				//Add head to table
				this.tableTarget.insertBefore(thead_new, this.tableTarget.firstChild)
	
			}
			
		}

	}

	_stripNumericCommas(str) {
		const regex = /^\d{1,3}(,\d{3})*(\.\d+)?$/;
		const match = str.match(regex);

		if ( match ) {
			return parseFloat(str.replace(/,/g,""))
		} else {
			return str;
		}
	}

})