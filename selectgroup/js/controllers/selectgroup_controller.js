application.register('selectgroup', class extends Stimulus.Controller {

	initialize() {
		this.dispatch("initialized");
	}

	connect() {
		
		this.config();

		this.dispatch("connected");

	}

	config() {

		this.setFinalSelect();	
		this._setOptionsAtts();
		this._addParentSelects();
		this._populateSelects();

	}

	disconnect() {
		this.dispatch("disconnected");
	}

	busy(isBusy) {
		this.element.ariaBusy = isBusy;

	}

	getDelimiter() {
		return this.element.dataset.selectgroupDelimiter || ":";
	}

	getFinalSelect() {
		const finalSelect = this.element.querySelector('select[data-selectgroup-final="true"]');

		if ( !finalSelect ) {
			throw new Error("No select with data-selectgroup-final='true' found in this controller.");
		}

		return finalSelect;
	}

	getLabel() {
		return this.element.dataset.selectgroupLabel || "Item";
	}

	getParentsArray() {
		let parents = this._getParentsArrayRaw();


		return this._expandParentsArray(parents);
	}

	getValuesForParent(parent, filter={}) {
		const finalSelect = this.getFinalSelect();
		const options = Array.from(finalSelect.querySelectorAll("option"));

		const valuesSet = new Set();

		options.forEach(option => {
			// Check if option matches all filter conditions
			const matches = Object.entries(filter).every(([key, value]) => {
			const attrValue = option.dataset[`selectgroup${this._capitalize(key)}`];
				return attrValue === value;
			});

			if (!matches) return;

			// Get value based on parent
			let val;
			if (parent === "") {
				// Final select: use label
				val = option.dataset.selectgroupLabel || option.textContent.trim();
			} else {
				//val = option.dataset[`selectgroupParent${this._capitalize(parent)}`];
				val = option.getAttribute(`data-selectgroup-parent-${parent.toLowerCase()}`);
			}

			if (val) valuesSet.add(val);
		});

		//Convert to array
		return Array.from(valuesSet)//.sort((a, b) => a.localeCompare(b));
	}

	onParentChange(event) {
		const parentSelect = event.target;

		const childName = parentSelect.dataset.selectgroupChild || "";
		let childSelect;

		if ( childName.length > 0 ) {
			childSelect = this.element.querySelector(`select[data-selectgroup-name="${childName}"]`);
		} else {
			childSelect = this.getFinalSelect();
		}

		if (!childSelect) return

		this.busy(true);

		this._populateSelect(childSelect);

		this.busy(false);

	}

	// Helper to capitalize parent names
	_capitalize(str) {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}


	setFinalSelect() {
		const selects = Array.from(this.element.querySelectorAll("select"));

		// Step 1: check if final select already exists
		const existingFinal = selects.find(s => s.dataset.selectgroupFinal === "true");
		if (existingFinal) return; // already set, do nothing

		// Step 2: ensure exactly one select
		if ( selects.length !== 1 ) {
			throw new Error(
				`Expected exactly one select, but found ${selects.length}.`
			);
		}

		// Step 3: set the final select
		selects[0].dataset.selectgroupFinal = "true";
	}

	_addParentSelects() {
		// Get the parent definitions
		const parents = this.getParentsArray();
		const children = Array.from(this.element.children);
		let beforeObject = this.element.firstChild;

		this.busy(true);

		// Create a select for each parent
		parents.forEach((parent, pp) => {
			
			children.forEach((child, ee) => {
				const clone = child.cloneNode(true);
				const options = clone.querySelectorAll('option');
				options.forEach(option => option.remove());


				const elements = clone.querySelectorAll('*');
				// Handle each element in the clone
				// Need to make sure unique attributes are unique to avoid conflicts
				// Also need to update labels and add attributes to tie selects to parents/children
				elements.forEach(el => {
					// Add the name of the parent to the following attributes: name, id, for (if they exist)
					["name", "id", "for"].forEach(attr => {
						if ( el.hasAttribute(attr) ) {
							el.setAttribute(attr, `${el.getAttribute(attr)}-${parent.name.toLowerCase()}`);
						}
					});
					if ( el.tagName.toLowerCase() === "label" ) {
						const parentLabel = parent.label || parent.name;
						el.textContent = el.textContent.replace(this.getLabel(), parentLabel);
						//clone.setAttribute("for", `${this.element.id || "selectgroup"}-${parent.name.toLowerCase()}`);
					}
					if ( el.tagName.toLowerCase() === "select" && el.getAttribute("data-selectgroup-final") === "true" ) {
						el.setAttribute("data-selectgroup-final","false");
						el.setAttribute("data-selectgroup-name",parents[pp].name);
						el.setAttribute("data-action","change->selectgroup#onParentChange");
						if ( pp > 0 ) {
							el.setAttribute("data-selectgroup-parent",parents[pp-1].name);
						}
						if ( pp < (parents.length-1) ) {
							el.setAttribute("data-selectgroup-child",parents[pp+1].name);
						} else {
							el.setAttribute("data-selectgroup-child","");
						}
					}
				});

				// Add object and make sure next object comes after it
				beforeObject = this.element.insertBefore(clone, beforeObject).nextSibling;
			});

			this.busy(false);
			
		});

		// Set the parent of the final select to the final parent.
		const finalSelect = this.getFinalSelect();
		finalSelect.setAttribute("data-selectgroup-parent",parents[parents.length-1].name);

	}

	_expandParentsArray(parents) {
		if (!Array.isArray(parents)) {
			throw new Error("_expandParentsArray expects an array of parent objects.");
		}

		const finalPlaceholder = this._getFinalSelectPlaceholder() || "";

		return parents.map(parent => {
			// Ensure each parent is an object
			if (typeof parent !== "object" || parent === null) {
				throw new Error("Each parent must be an object with at least a 'name' key.");
			}

			const name = parent.name;
			if (!name) {
				throw new Error("Each parent object must have a 'name' key.");
			}

			// Use name as label if not provided
			const label = parent.label || name;

			// Use placeholder from final select if not provided
			// Replace the label part of the final select placeholder if applicable
			let placeholder;
			if ( parent.placeholder ) {
				placeholder = parent.placeholder;
			} else {
				// Get the final select placeholder text
				placeholder = finalPlaceholder;

				// Replace data-selectgroup-label part with this parent's label if it exists
				const finalSelectLabel = this.element.dataset.selectgroupLabel || "";
				if ( finalSelectLabel && placeholder.includes(finalSelectLabel) ) {
					placeholder = placeholder.replace(finalSelectLabel, label);
				}
			}

			return {
				...parent,
				label,
				placeholder
			};
		});
	}


	_getFinalSelectPlaceholder() {
		const finalSelect = this.getFinalSelect(); // assumes you have getFinalSelect() defined

		if (!finalSelect) return null;

		const placeholderOption = Array.from(finalSelect.options).find(
			option => option.value === ""
		);

		return placeholderOption ? placeholderOption.textContent.trim() : null;
	}


	_getParentsArrayRaw() {
		const attr = this.element.dataset.selectgroupParents;
		if (!attr) {
			throw new Error("Missing required `data-selectgroup-parents` attribute.");
		}

		let parents;

		// Try JSON parsing first
		try {
			const parsed = JSON.parse(attr);
			if (Array.isArray(parsed) && parsed.length > 0) {
				// Normalize to objects if they are strings
				parents = parsed.map(p =>
					typeof p === "string" ? { name: p.trim() } : p
				);
				//return parents;
			}
		} catch (e) {
			// Check for forbidden JSON special characters to distinguish plain string
			if (/[\[\]\{\}"']/.test(attr)) {
				throw new Error(
				"`data-selectgroup-parents` contains invalid characters. Use a JSON array or a simple delimiter string."
				);
			}

			// Treat as delimited string
			const delimiter = this.getDelimiter();
			parents = attr
				.split(delimiter)
				.map(p => p.trim())
				.filter(Boolean)
				.map(p => ({ name: p }));

			if ( parents.length === 0 ) {
				throw new Error("`data-selectgroup-parents` must define at least one parent.");
			}
		}

		return parents;
	}

	_populateSelects() {
		const parentSelects = Array.from(this.element.querySelectorAll("select[data-selectgroup-name]"));

		this.busy(true);

		// Populate parent selects
		parentSelects.forEach((select) => {
			this._populateSelect(select);
		});
		this._populateSelect(this.getFinalSelect());

		this.busy(false);

	}

	_populateSelect(select) {

		select.disabled = true;

		// Determine filter from previous parent selections
		const filter = {};
		if ( select.dataset.selectgroupParent ) {
			const parentSelect = this.element.querySelector(`select[data-selectgroup-name="${select.dataset.selectgroupParent}"]`);
			// Only filter if a value is selected
			if ( parentSelect.selectedIndex ) {
				filter[select.dataset.selectgroupParent] = parentSelect.value;
			}
		}

		// Get distinct values for this parent
		const parentName = select.dataset.selectgroupName || "";
		const values = this.getValuesForParent(parentName, filter);

		if ( select.dataset.selectgroupFinal === "true" ) {
			
			// Loop over all of the options in select
			const options = Array.from(select.options);
			options.forEach(option => {
				const hideOption = (
					option.value !== ""// Keep placeholder visible
					&& 
					!values.includes(option.dataset.selectgroupLabel || option.textContent.trim())
				);
				option.hidden = hideOption;
				option.textContent = option.dataset.selectgroupLabel || option.dataset.Label || option.textContent.trim();
				if ( hideOption && option.selected ) {
					option.selected = false;
				}
		 	});

		} else {
			select.innerHTML = "";
			

			const opt = document.createElement("option");
			opt.value = "";
			opt.textContent = select.dataset.selectgroupPlaceholder || `Choose a ${parentName}`;
			select.appendChild(opt);
			const finalSelect = this.getFinalSelect();
			const selectedOption = finalSelect.options[finalSelect.selectedIndex];

			// Add options
			values.forEach(value => {
				const opt = document.createElement("option");
				opt.value = value;
				opt.textContent = value;
				
				// If this value matches the selected option in the final select, mark it as selected
				if ( selectedOption && selectedOption.dataset[`selectgroupParent${this._capitalize(parentName)}`] === value ) {
					opt.selected = true;
				}

				select.appendChild(opt);
			});

	}


		select.disabled = false;

	}

	_setOptionsAtts() {
		const finalSelect = this.getFinalSelect();
		const delimiter = this.element.dataset.selectgroupDelimiter || ":";
		const options = Array.from(finalSelect.querySelectorAll("option"));

		options.forEach(option => {

			// Split the option text by the delimiter and take the last item
			const parts = option.textContent.split(delimiter).map(p => p.trim());

			if ( !option.dataset.selectgroupOriginal ) {
				option.dataset.selectgroupOriginal = option.textContent.trim();
			}

			// Set the data-selectgroup-label attribute if not already set
			if ( !option.dataset.selectgroupLabel ) {
				
				const label = parts[parts.length - 1] || option.textContent.trim();
				// Set the data-selectgroup-label attribute
				option.dataset.selectgroupLabel = label;

			}
			
			// Set the data-selectgroup-parents attribute if not already set
			if ( !option.dataset.selectgroupParents ) {
				if ( parts.length < 2 ) {
					// If there's only one part, set parents to an empty string
					option.dataset.selectgroupParents = "";
				} else {
					const parentsString = parts.slice(0, parts.length - 1).join(delimiter);
					option.dataset.selectgroupParents = parentsString;
				}
			}
			
			// Set the data-selectgroup-parents attribute to JSON  if it isn't already
			
			if ( !this.isLikelyJSON(option.dataset.selectgroupParents) ) {
				option.dataset.selectgroupParents = JSON.stringify(this._convertParentsStringToJSON(option.dataset.selectgroupParents));
			}

			//Set each individual parent as its own data attribute
			const oParents = JSON.parse(option.dataset.selectgroupParents);
			Object.keys(oParents).forEach(parentName => {
				//We're using data-selectgroup-{parentName} and data-selectgroup-parent-{parentName} in case we need a parent name that conflicts with another attribute
				const attr = `data-selectgroup-${parentName.toLowerCase()}`;
				const attrp = `data-selectgroup-parent-${parentName.toLowerCase()}`;
				if ( !option.getAttribute(attr) ) {
					option.setAttribute(attr,oParents[parentName]);
				}
				if ( !option.getAttribute(attrp) ) {
					if ( parentName === "label" || parentName === "parents" ) {
						option.setAttribute(attrp,oParents[parentName]);
					} else {
						option.setAttribute(attrp,option.getAttribute(attr));
					}
				}
			});
			

		});
	}

	_convertParentsStringToJSON(parentsString) {
		if (!parentsString || !parentsString.trim()) return {};

		// Get the parent definitions from the container
		const parents = this.getParentsArray(); // returns array of objects [{name: "Nation"}, {name: "City"}, ...]

		const values = parentsString.split(this.element.dataset.selectgroupDelimiter || ":").map(s => s.trim());

		const result = {};

		values.forEach((value, index) => {
			if (parents[index]) {
				result[parents[index].name] = value;
			}
		});

		return result;
	}

	isLikelyJSON(str) {
		if (typeof str !== "string") return false;

		const trimmed = str.trim();

		// JSON arrays start with [ and end with ]
		if (trimmed.startsWith("[") && trimmed.endsWith("]")) return true;

		// JSON objects start with { and end with }
		if (trimmed.startsWith("{") && trimmed.endsWith("}")) return true;

		return false;
	}
	
})