
application.register('chartjs', class extends Stimulus.Controller {
/*
-MutationObserver actions
-Ability to use attribute to indicate a lebel column or a data column
-If not att provided, controller will call first column with text a label col and any col with only numbers as a data column
-Allow data to be passed in via data-chartjs-data instead of table
*/

	initialize() {

	}

	connect() {

		this.config();
		this.loadChart();
		this.loadMutationObserver();

		this.dispatch("connected");

	}

	disconnect() {
		this.chart.destroy();
		this.observer.disconnect();

		this.dispatch("disconnected");
	}

	config() {

		switch( this.element.tagName.toLowerCase() ) {
			case "canvas":
				this.canvas = this.element;

				if ( this.element.hasAttribute("data-chartjs-table") ) {
					//The table should be gotten from the attribute
					this.table = document.querySelector(this.element.getAttribute("data-chartjs-table"));
					//otherwise get the first table in the canvas element
				} else {
					this.table = this.element.querySelector("table");
					if ( this.table.tagName.toLowerCase() != "table" ) {
						throw new Error('A table must be provided for data.');
					}
					//ToDo: Hopefully that can be optional later and allow data passed in via an attribute - though I prefer the table option.
				}
				
			break;
			case "table":
				this.table = this.element;

				if ( this.element.hasAttribute("data-chartjs-canvas") ) {
					var canvasAttribute = this.element.getAttribute("data-chartjs-canvas");

					switch ( canvasAttribute.toLowerCase() ) {
						case "before":
						case "after":
						case "replace":
							this.canvas = this._addCanvas(canvasAttribute.toLowerCase());
							if ( canvasAttribute.toLowerCase() == "replace" ) {
								return;
							}
						break;
						default:
							//Use an indicated canvas element if there is one.
							this.canvas = document.querySelector(canvasAttribute);
							if ( this.canvas.tagName != "CANVAS" ) {
								throw new Error('The "data-chartjs-canvas" must point to a canvas element on the page.');
							}
					}

				} else if ( this.element.parentNode.tagName.toLowerCase() == "canvas" ) {
					//Use the parent if it is a canvas element.
					this.canvas = this.element.parentNode;
				} else {
					//Otherwise put the table into a canvas element
					this.canvas = this._addCanvas("replace");//This will cause connect to run again.
					return;
				}
				
			break;
			default:
				throw new Error('The "chartjs" controller should be placed on a canvas element, either with a table in it or with a "data-chartjs-table" attribute indicating the table.');
		}

	}

	loadChart() {

		this.chart = new Chart(this.canvas, this.getConfig());

	}

	update() {

		this.busy(true);

		this.chart.destroy();
		this.loadChart();

		this.busy(false);

		this.dispatch("updated");
	}

	busy(isBusy) {

		// Add or remove identifier from busywith attribute to indicate that the element is busy with this controller
		if ( isBusy ) {
			this.canvas.dataset.busywith = (this.canvas.dataset.busywith || '') + ' ' + this.identifier;
		} else {
			this.canvas.dataset.busywith = (this.canvas.dataset.busywith || '').replace(this.identifier, '').trim();
		}

		// Set aria-busy attribute to indicate that the element is doing anything
		this.canvas.ariaBusy = ( this.canvas.dataset.busywith.length > 0 );

	}

	dispatch(eventName) {

		arguments.canvas = this.canvas;
		arguments.table = this.table;

		super.dispatch(eventName, ...arguments);
	}

	loadMutationObserver() {
		this.observer = new MutationObserver(
			(mutations) => this.mutationListener(mutations)
		);

		this.observer.observe(
			this.table,
			{
				childList: true,
				attributes: true,
				subtree: true
			}
		);

		this.observer.observe(
			this.canvas,
			{
				attributes: true
			}
		);

	}

	_alterAttribute(mutation) {

		switch ( mutation.attributeName ) {
			case "data-chartjs-type":
				this.chart.config.type = mutation.target.getAttribute(mutation.attributeName);
				//Leaving out break because options may need to reset when type changes to keep artifacts from appearing.
			case "data-chartjs-options":
				this.chart.options = this.getOptions();
				this.chart.update();
			break;
		}
		
	}

	mutationListener(mutations) {

		var doReloadData = false;

		for ( var mutation of mutations ) {
			switch ( mutation.target.tagName.toLowerCase() ) {
				case "canvas":
					if ( mutation.type == "attributes" ) {
						this._alterAttribute(mutation);
					}
				break;
				case "table":
					switch( mutation.type ) {
						case "attributes":
							//Handle attributes changes on table
							this._alterAttribute(mutation);
						break;
						case "childList":
							//If interior of table has changed, reload all of the data
							//console.log("EVERYTHING");
							//this.chart.data = this.getData();
							doReloadData = true;
						break;
					}
				break;
				case "caption":
					this.chart.options.plugins.title.text = mutation.target.textContent;
				break;
				case "col":
				case "th":
					//ToDo: Need to switch based on indicator of label column and on presence in head rather than td vs th.
					var th = mutation.target;
					var oPos = this._getCellPosition(th);

					if ( mutation.type == "attributes" ) {
						//ToDo: Respond to attributes change on a column
					}
					
				break;
				case "td":
					//Handle data changes in TDs

					//console.table(mutation);
					var td = mutation.target;
					var oPos = this._getCellPosition(td);
					
					switch( mutation.type ) {
						case "attributes":
						case "childList":
							//TextNode or attributes changed
							if ( this.chart.data.datasets[oPos.column-1] && this.chart.data.datasets[oPos.column-1].data[oPos.row-1] ) {
								//this.chart.data.datasets[oPos.column-1].data[oPos.row-1] = this._getElementValue(td);
							}
						break;
					}
					break;
				case "tr":
					doReloadData = true;

				break;
			}
		}

		if ( doReloadData ) {
			this.chart.data = this.getData();
		}
		
		this.chart.update();

	}

	getConfig() {
		var oConfig = {
			type:this.getAttribute('type','bar'),
			data:this.getData(),
			options:this.getOptions()
		};

		return oConfig;
	}

	_getColumnDataIndices(labelIndex) {
		var cols = this.table.querySelectorAll("col");
		var ths = this.table.querySelectorAll("thead th");
		var aCols = [];

		for ( var col = 0; col < ths.length; col++ ) {
			if (
				( ths[col].hasAttribute("data-chartjs-type") && ths[col].getAttribute("data-chartjs-type") == "data" )
				||
				( cols[col] && cols[col].hasAttribute("data-chartjs-type") && cols[col].getAttribute("data-chartjs-type") == "data" )
			) {
				aCols.push(col);
			}
		}

		if (  aCols.length == 0 ) {
			for ( var col = 0; col < ths.length; col++ ) {
				if ( col != labelIndex && !ths[col].hasAttribute("data-chartjs-ignore") ) {
					aCols.push(col);
				}
			}
		}

		return aCols;
	}

	_getColumnLabelIndex() {
		var ths = this.table.querySelectorAll("thead th");
		var cols = this.table.querySelectorAll("col");

		for ( var i = 0; i < ths.length; i++ ) {
			if ( ths[i].hasAttribute("data-chartjs-type") && ths[i].getAttribute("data-chartjs-type") == "label" ) {
				return i;
			}
		}

		for ( var i = 0; i < cols.length; i++ ) {
			if ( cols[i].hasAttribute("data-chartjs-type") && cols[i].getAttribute("data-chartjs-type") == "label" ) {
				return i;
			}
		}

		return 0;
	}

	getData() {
		var cols = this.table.querySelectorAll("col");
		var ths = this.table.querySelectorAll("thead th");
		var tds = this.table.querySelectorAll("tbody tr:first-child td");
		var aDataSets = [];
		var labelIndex = this._getColumnLabelIndex();
		var oData = {
			labels:this._getRowLabelsForColumn(labelIndex)
		};
		var aDataCols = this._getColumnDataIndices(labelIndex);

		//Intentionally skipping the first row, as that is for labels
		for ( var ii in aDataCols ) {
			var col = aDataCols[ii];

			var oDataSet = {};
			if ( false ) {
				var bgcolor = window.getComputedStyle(tds[col])["backgroundColor"];
				if ( bgcolor != "rgba(0, 0, 0, 0)" ) {
					oDataSet["backgroundColor"] = bgcolor;
				}
			}
			//Use options for this column from the attribute in JSON
			if ( cols[col] && cols[col].hasAttribute("data-chartjs-options") ) {
				oDataSet = {
					...oDataSet,
					...this.parseOptions(cols[col].getAttribute("data-chartjs-options"))
				};
				//oDataSet = ;
			}
			//Use options for this column from the attribute in JSON
			if ( ths[col].hasAttribute("data-chartjs-options") ) {
				oDataSet = {
					...oDataSet,
					...this.parseOptions(ths[col].getAttribute("data-chartjs-options"))
				};
				//oDataSet = ;
			}
			//Now add in the label and the data from the table
			oDataSet.label = this._getRowLabelsForColumn(ths[col]);
			oDataSet.data = this._getRowValuesForColumn(col);

			aDataSets.push(oDataSet);
		}

		oData.datasets = aDataSets;

		return oData;
	}

	getOptions() {
		var options_str = this.getAttribute("options","{}");
		var oOptions = this.parseOptions(options_str);

		this._addCaptionTitle(oOptions);

		return oOptions;
	}

	/**
	 * I get a data-chartjs- attribute from the table or the canvas element.
	 * @param {string} attName 
	 * @param {string} defaultValue 
	 * @returns  string
	 */
	getAttribute(attName,defaultValue) {
		var fullAttName = "data-chartjs-" + attName;
		if ( this.table.hasAttribute(fullAttName) ) {
			return this.table.getAttribute(fullAttName);
		} else if ( this.canvas.hasAttribute(fullAttName) ) {
			return this.canvas.getAttribute(fullAttName);
		} else {
			return defaultValue;
		}
	}

	parseOptions(options) {
		var oOptions = {};

		if ( options ) {
			oOptions = JSON.parse(options);
		}

		//Convert any CSS custom proerties to their values
		for ( var key in oOptions ) {
			if ( typeof oOptions[key] == "string" ) {
				if ( oOptions[key].startsWith('--') && getComputedStyle(this.element).getPropertyValue(oOptions[key])) {
					oOptions[key] = getComputedStyle(this.element).getPropertyValue(oOptions[key]).trim();
				}
			}
		}

		return oOptions;
	}

	/**
	 * I add a title to the chart from the table caption if one exists
	 */
	_addCaptionTitle(oOptions) {
		//Get title from table caption
		if ( this.table.querySelector("caption") ) {
			var oTitle = {
				title: {
					display: true,
					text: this.table.querySelector("caption").textContent,
				}
			}

			// Check if plugins exist, if not, create it
			if ( !oOptions.plugins ) {
				oOptions.plugins = {};
			}

			// Merge the objectToAppend into plugins
			oOptions.plugins = {
				...oOptions.plugins,
				...oTitle
			};
		}
	}

	_cleanCurrency(str) {

		if ( typeof str == 'string' && /^[$€£]?\s?\d{1,3}([,.\s]?\d{3})*(\.\d{2})?$/.test(str) ) {
			return str.replace(/[^0-9.]/g, ''); // Remove currency symbols and commas
		} else {
			return str; // Return original string if no match is found
		}
	}

	/**
	 * I get the value of the given element, going by [data-chartjs-value] then [data-value] then the text of the element.
	 * @param {HTMLElement} elem 
	 * @returns {string}
	 */
	_getElementLabel(elem) {
		var inputs = elem.getElementsByTagName("input");

		if ( elem.textContent.length == 0 && inputs.length == 1 ) {
			if ( inputs[0].type == "checkbox" || inputs[0].type == "radio" ) {
				return inputs[0].checked ? "Yes" : "No";
			} else {
				return inputs[0].value;
			}
		} else {
			return elem.textContent;
		}
	}

	/**
	 * I get the value of the given element, going by [data-chartjs-value] then [data-value] then the text of the element.
	 * @param {HTMLElement} elem 
	 * @returns {string}
	 */
	_getElementValue(elem) {
		var datas = elem.getElementsByTagName("data");
		var inputs = elem.getElementsByTagName("input");
		var result = "";

		if ( elem.hasAttribute("data-chartjs-value") ) {
			result = elem.getAttribute("data-chartjs-value");
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

		result = this._stripNumericCommas(result);
		result = this._cleanCurrency(result);

		return result;
	}

	_getElemOptionObj(elem) {
		var oResult = {
			value: this._getElementValue(elem),
			label: elem.textContent
		};

		return oResult;
	}

	/**
	 * I get an arrray of values for 
	 * @param {HTMLElement[]} elems 
	 * @returns {object[]} An array of objects.
	 */
	_getElementsObjKeys(elems,key) {
		var aValues = [];

		for ( var elem of elems ) {

			if ( elem.offsetParent !== null && !elem.parentNode.hasAttribute("data-chartjs-ignore") ) {
				aValues.push(this._getElemOptionObj(elem)[key]);
			}
		}

		return aValues;
	}

	/**
	 * I get an arrray of values for 
	 * @param {HTMLElement[]} elems 
	 * @returns {string[]} An array of values.
	 */
	_getElementsLabels(elems) {

		return this._getElementsObjKeys(elems,"label");
	}

	/**
	 * I get an arrray of values for 
	 * @param {HTMLElement[]} elems 
	 * @returns {string[]} An array of values.
	 */
	_getElementsValues(elems) {

		return this._getElementsObjKeys(elems,"value");
	}

	_getCellPosition(td) {
		return { row: td.parentNode.rowIndex, column: td.cellIndex };
	}

	/**
	 * I get an array of rows for the given column number
	 * @param {number} colnum 
	 * @returns {HTMLElement[]}
	 */
	_getRowsForColumn(colnum) {
		var table = this.table.getElementsByTagName('tbody')[0];
		var aCells = [];

		// Iterate through each row of the table
		for ( var row of table.rows ) {
			//console.log(row.hasAttribute("hidden"));
			if ( row.cells[colnum] && !row.hasAttribute("hidden") ) {
				aCells.push(row.cells[colnum]);
			}
			
		}

		return aCells;
	}

	_getRowLabelsForColumn(colnum) {
		return this._getElementsLabels(this._getRowsForColumn(colnum));
	}

	_getRowValuesForColumn(colnum) {
		return this._getElementsValues(this._getRowsForColumn(colnum));
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

	// Hopefully not needed, but will allow this to work if it is added to a table that is missing the canvas element.
	_addCanvas(where) {

		if ( where.toLowerCase() == "replace" && this.element.parentNode.tagName == "CANVAS" ) {
			return this.element.parentNode;
		}

		var canvas = document.createElement('canvas');

		switch ( where.toLowerCase() ) {
			case "before":
				this.table.parentNode.insertBefore(canvas, this.table);
			break;
			case "after":
				//this.table.parentNode.insertAfter(canvas, this.table);
				
				this.table.parentNode.insertBefore(canvas, this.table.nextSibling);

			break;
			default://"replace"
				canvas.width = this.table.offsetWidth; // Set canvas width to match the table width
				canvas.height = this.table.offsetHeight; // Set canvas height to match the table height
				
				this.table.parentNode.insertBefore(canvas, this.table);
				canvas.appendChild(this.table);
		}

		return canvas;
	}

})
