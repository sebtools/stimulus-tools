application.register('selectfilter', class extends Stimulus.Controller {
	static targets = ["select"];

	connect() {
		this.assignSelectTarget();
		this.ensurePlaceholder();
		this._createSearchableDropdown();
	}

	assignSelectTarget() {
		if ( !this.hasSelectTarget ) {
			if ( this.element.tagName.toLowerCase() !== 'select' ) {
				throw new Error("You must either set the 'select' target or use a <select> as the root element.");
			}
			this.element.setAttribute("data-selectfilter-target", "select");
		}
	}

	ensurePlaceholder() {
		if ( !this.selectTarget.hasAttribute("data-selectfilter-placeholder"))  {
			
			if ( this.selectTarget.hasAttribute("data-placeholder"))  {
				//If data-placeholder is set, copy it to data-selectfilter-placeholder
				this.selectTarget.setAttribute(
					"data-selectfilter-placeholder",
					this.selectTarget.getAttribute("data-placeholder")
				);
			} else {
				//Otherwise, set data-selectfilter-placeholder to "Search..."
				this.selectTarget.setAttribute("data-selectfilter-placeholder", "Search...");
			}
		}
	}

	filterOptions() {
		const searchTerm = this.searchBox.value.toLowerCase();
		Array.from(this.dropdown.children).forEach(item => {
			const text = item.textContent.toLowerCase();
			item.style.display = text.includes(searchTerm) ? "block" : "none";
		});
	}

	selectOption(value, text) {
		this.searchBox.value = text;
		this.selectTarget.value = value;
		this.dropdown.style.display = "none";
	}

	_createSearchableDropdown() {
		// Hide original select
		this.selectTarget.style.display = "none";
		
		// Create wrapper div
		this.wrapper = document.createElement("div");
		this.wrapper.classList.add("searchable-dropdown");
		
		// Create input field
		this.searchBox = document.createElement("input");
		this.searchBox.type = "text";
		this.searchBox.placeholder = this.selectTarget.getAttribute("data-selectfilter-placeholder");
		this.searchBox.classList.add("search-box");
		this.searchBox.addEventListener("input", this.filterOptions.bind(this));
		this.searchBox.addEventListener("focus", () => this.dropdown.style.display = "block");
		this.searchBox.addEventListener("blur", () => setTimeout(() => this.dropdown.style.display = "none", 200));
		
		// Create dropdown list
		this.dropdown = document.createElement("ul");
		this.dropdown.classList.add("dropdown-list");
		
		// Populate dropdown
		this._populateDropdown();
		
		// Append elements
		this.wrapper.appendChild(this.searchBox);
		this.wrapper.appendChild(this.dropdown);
		this.selectTarget.parentNode.insertBefore(this.wrapper, this.selectTarget);
	}

	_populateDropdown() {
		this.dropdown.innerHTML = "";
		Array.from(this.selectTarget.options).forEach(option => {
			const item = document.createElement("li");
			item.textContent = option.text;
			item.dataset.value = option.value;
			item.classList.add("dropdown-item");
			item.addEventListener("click", () => this.selectOption(option.value, option.text));
			this.dropdown.appendChild(item);
		});
	}

})