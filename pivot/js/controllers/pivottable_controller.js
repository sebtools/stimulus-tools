/*
 * PivotTable Controller for Stimulus
 * This controller is responsible for creating a pivot table from a source table.
 
ToDo:
- If pivot column is the same as the group column then don't show the pivot columns.
- Add "data-pivottable-coltype" attributes to the th elements of the source table?
*/

application.register('pivottable', class extends Stimulus.Controller {
	static targets = ["table"];

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

		this.build();
		this._addMutationListeners();
		this._setUpStyles();
		
	}

	disconnect() {

		// Remove the mutation observer when the controller is disconnected
		if ( this.observer ) {
			this.observer.disconnect();
		}

		this.dispatch("disconnected");

	}

	build() {
		this.dispatch("building");
		this.busy(true);

		this.buildPivotTable();

		this.busy(false);
		this.dispatch("built");

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

	buildPivotTable() {
		let controller = this.element;
		let sourceTable = this.getSourceTable();

		if ( !sourceTable ) {
			console.error(`Source table with ID "${sourceTableId}" not found.`);
			return;
		}

		let groupColumns = controller.getAttribute("data-pivottable-group").trim().split(",");
		let sortColumn = controller.getAttribute("data-pivottable-sort");
		let dataField = controller.getAttribute("data-pivottable-field");
		let operation = controller.getAttribute("data-pivottable-operation");
		let pivotColumn = controller.getAttribute("data-pivottable-pivot").trim();

		// Remove empty entries from groupColumns array
		groupColumns = groupColumns.filter(col => col.trim() !== "");

		if ( !groupColumns || groupColumns.length === 0 ) {
			//Set the groupColumns to the text of the first th element in the source table
			let firstTh = sourceTable.querySelector("thead th");
			if ( firstTh ) {
				groupColumns = [firstTh.textContent.trim()];
			} else {
				console.error("No group columns specified and no th elements found in the source table.");
				return;
			}
		}

		// Remove any columns in pivotColumns that are also in groupColumns
		if ( groupColumns.includes(pivotColumn) ) {
			pivotColumn = groupColumns.includes(pivotColumn) ? "" : pivotColumn;
		}

		let data = {};
		let counts = {};
		let uniqueColumns = new Set();
		let rows = Array.from(sourceTable.querySelectorAll("tbody tr")).filter(row => row.offsetParent !== null);

		// Find field indexes dynamically
		let headers = Array.from(sourceTable.querySelectorAll("thead th"));
		let fieldIndex = headers.findIndex(th => th.textContent === dataField);
		let pivotIndex = headers.findIndex(th => th.textContent === pivotColumn);
		// Find group column indexes dynamically
		// Find the indexes of the group columns in the headers
		let groupIndexes = groupColumns.map(col => headers.findIndex(th => th.textContent === col));

		// Check if the field and pivot column indexes are valid
		if ( fieldIndex === -1 ) {
			console.error(`Field "${dataField}" not found.`);
			return;
		}

		// Read the original table data
		rows.forEach(row => {
			let cells = row.querySelectorAll("td");
			let groupKey = groupIndexes.map(index => cells[index].textContent).join("|");
			let pivotValue = cells[pivotIndex].textContent;
			let value = parseFloat(this.getCellValue(cells[fieldIndex]));// parseFloat(cells[fieldIndex].textContent);

			uniqueColumns.add(pivotValue);

			// Check if the group key already exists in the data object
			if ( !data[groupKey] ) {
				// Initialize the group key if it doesn't exist
				data[groupKey] = {};
				counts[groupKey] = {};
			}
			
			// Check if the pivot value already exists in the data object
			if ( !data[groupKey][pivotValue] ) {
				// Initialize the pivot value if it doesn't exist
				data[groupKey][pivotValue] = 0;
				counts[groupKey][pivotValue] = 0;
			}

			data[groupKey][pivotValue] += value;
			counts[groupKey][pivotValue]++;
		});

		// Apply aggregation operation
		if ( operation === "avg" ) {
			Object.keys(data).forEach(key => {
				Object.keys(data[key]).forEach(pivotValue => {
					if (counts[key][pivotValue] > 0) {
						data[key][pivotValue] = (data[key][pivotValue] / counts[key][pivotValue]).toFixed(2);
					}
				});
			});
		}

		// Sort data based on the specified column
		let sortedKeys = Object.keys(data).sort((a, b) => {
			const splitA = a.split("|");
			const splitB = b.split("|");
			const index = groupColumns.indexOf(sortColumn);
		
			// Ensure the index is valid and the split arrays have enough elements
			const aValue = index >= 0 && index < splitA.length ? splitA[index] : "";
			const bValue = index >= 0 && index < splitB.length ? splitB[index] : "";
		
			return aValue.localeCompare(bValue);
		});

		// Create table dynamically

		//If there is a table element in the controller, us it.
		//Otherwise, create a new table element and append it to the controller
		let table = controller.querySelector("table");
		if ( table ) {
			// If a table already exists, clear its contents
			table.innerHTML = ""; // Clear previous table contents
		} else {
			// Create a new table element and append it to the controller
			table = document.createElement("table");
		}
		let thead = document.createElement("thead");
		let tbody = document.createElement("tbody");
		let theadRow = document.createElement("tr");

		// Copy any values from the "data-controller" attribute to the table element, except for the "pivottable" part
		let controllerAttributes = this.element.getAttribute("data-pivottable-controller") || "";
		if ( controllerAttributes.length > 0 ) {
			table.setAttribute("data-controller", controllerAttributes);
		}

		//Copy any attributes from the controller to the table element, except for the "data-controller" attribute and any attributes starting with "data-pivottable-"
		for ( let attr of this.element.attributes ) {
			if (
				attr.name !== "data-controller"
				&&
				attr.name.startsWith("data-")
				&&
				!attr.name.startsWith("data-pivottable-")
				&&
				!attr.name.startsWith("data-busywith")
			) {
				table.setAttribute(attr.name, attr.value);
			}
		}

		// Create dynamic headers
		let sortedColumns = Array.from(uniqueColumns).sort();
		theadRow.innerHTML = `<th>${groupColumns.join('</th data-pivottable-col="group"><th>')}</th>` + sortedColumns.map(c => `<th data-pivottable-col="value">${c}</th>`).join("") + '<th data-pivottable-col="aggregate">Total</th>';
		thead.appendChild(theadRow);

		// Populate the pivot table
		sortedKeys.forEach(key => {
			let groupValues = key.split("|");
			let row = document.createElement("tr");

			let rowData = groupValues.map(val => `<td data-pivottable-col="group">${val}</td>`);
			let total = 0;

			sortedColumns.forEach(pivotValue => {
				let value = data[key][pivotValue] || 0;
				total += parseFloat(value);
				rowData.push(`<td data-pivottable-col="value" data-value="${value}">${this.numberformat(value)}</td>`);
			});

			rowData.push(`<td data-pivottable-col="aggregate" data-value="${total}">${this.numberformat(total)}</td>`);
			row.innerHTML = rowData.join("");
			tbody.appendChild(row);
		});

		// Add aria-sort attribute to the sort column header
		let sortColumnIndex = groupColumns.indexOf(sortColumn);
		if ( sortColumnIndex !== -1 ) {
			let thElements = theadRow.querySelectorAll("th");
			thElements[sortColumnIndex].setAttribute("aria-sort", "ascending");
		}

		// Append table to pivot container
		table.appendChild(thead);
		table.appendChild(tbody);
		controller.innerHTML = ""; // Clear previous table if any
		controller.appendChild(table);
	}

	getCellValue(td) {
		let result = "";
		let datas = td.getElementsByTagName("data");

		if ( td.hasAttribute("data-value") ) {
			result = td.getAttribute("data-value");
		} else if ( datas.length == 1 ) {
			result = datas[0].value;
		} else {
			let inputs = td.getElementsByTagName("input");

			if ( td.textContent.length == 0 && inputs.length == 1 ) {
				if ( inputs[0].type == "checkbox" || inputs[0].type == "radio" ) {
					result = inputs[0].checked ? "1" : "0";
				} else {
					result = inputs[0].value;
				}
			} else {
				result = td.textContent;
			}

		}
		
		result = result.trim();

		result = this._cleanCurrency(result);

		return result;
	}

	getName(th) {

		if ( th.hasAttribute("data-pivottable-name") ) {
			return th.getAttribute("data-pivottable-name").trim();
		} else if ( th.hasAttribute("data-name") ) {
			return th.getAttribute("data-name").trim();
		} else {
			return th.textContent.trim();
		}
	}

	getColumns(names) {
		const sourceTable = this.getSourceTable();
		const headers = Array.from(sourceTable.querySelectorAll("thead th"));
		const groupColumns = names.split(",");

		const columns = headers.filter(th => groupColumns.includes(this.getName(th)));

		return columns;
	}

	getSourceTable() {
		let sourceTableId = this.element.getAttribute("data-pivottable-source");
		return document.getElementById(sourceTableId);
	}

	numberformat(number) {
		// Format the number with commas// and two decimal places
		return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");// + ".00";
	}

	// Clean the currency string by removing symbols and commas
	_cleanCurrency(str) {

		if ( /^[$€£]?\s?\d{1,3}([,.\s]?\d{3})*(\.\d{2})?$/.test(str) ) {
			return str.replace(/[^0-9.]/g, ''); // Remove currency symbols and commas
		} else {
			return str; // Return original string if no match is found
		}
	}

	_setUpStyles() {
		//Check to see if any styles are applied to td elements with an attribute of "data-pivottable-col"
		const oTest = document.createElement('span');
		oTest.setAttribute('data-pivottable-col', 'value');
		document.body.appendChild(oTest);
		const hasStyle = ( window.getComputedStyle(oTest).cssText !== '' );
		document.body.removeChild(oTest);

		//If not, add the styles to the td elements with an attribute of "data-pivottable-col"
		if ( !hasStyle ) {
			const style = document.createElement('style');

			style.innerHTML = `
				td[data-pivottable-col="group"] { text-align: left; }
				td[data-pivottable-col="value"] { text-align: right; }
				td[data-pivottable-col="aggregate"] { font-weight:bold;text-align: right; }`;
			document.head.appendChild(style);
		}
	}

    _addMutationListeners() {
		const oSourceTable = this.getSourceTable();
		// Create a MutationObserver to watch for changes in the form
		this.observer = new MutationObserver(() => {
			console.log("Mutation detected in source table. Rebuilding pivot table.");
			this.build();
		});
		
		// Re-create the pivot table when the source table changes
		this.observer.observe(oSourceTable, {
			childList: true,
			subtree: true
		});

		// Observe changes to hidden attribute in rows
		this.observer.observe(oSourceTable, {
			attributes: true,
			attributeFilter: ['hidden'],
			subtree: true
		});

		// Observe changes to the attributes of the root element
		this.observer.observe(this.element, {
			attributes: true,
			attributeFilter: ['data-pivottable-source', 'data-pivottable-group', 'data-pivottable-sort', 'data-pivottable-field', 'data-pivottable-operation', 'data-pivottable-pivot']
		});
	}

});