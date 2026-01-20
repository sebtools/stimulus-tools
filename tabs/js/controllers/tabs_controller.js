application.register('tabs', class extends Stimulus.Controller {
	//static targets = ["tab", "panel"];

	connect() {

		this.addEventListeners();

		this.showSelectedPanel();

		//Attaching controller to object so we can call methods on it.
		this.element[this.identifier] = this;

		this.dispatch("connected");

	}

	addEventListeners() {
		const tabButtons = this.getTabButtons();
		tabButtons.forEach(button => {

			// Add click and keydown listeners
			button.addEventListener("click", (event) => this.onClick(event));

			// Add keydown listener
			button.addEventListener("keydown", (event) => this.onKeydown(event));
		});

		// Also add listeners to child elements to ensure events bubble up
		tabButtons.forEach(button => {
			const childElements = button.querySelectorAll('*');
			childElements.forEach(child => {
				child.addEventListener("click", (event) => {
					// Let the event bubble up to the button
					//if (!event.target.closest('[role="tab"]')) return;
					this.onClick(event);
				});
			});
		});
	}

	disconnect() {
		this.dispatch("disconnected");
	}

	onClick(event) {
		const target = event.target.closest('[role="tab"]');
		if ( target ) {
			this.selectTab(target);
		}
	}

	onKeydown(event) {
		if (event.target.getAttribute("role") !== "tab") return;
		
		const tabButtons = this.getTabButtons();
		const tabs = Array.from(tabButtons);
		let index = tabs.indexOf(event.target);

		if (event.key === "ArrowRight") index = (index + 1) % tabs.length;
		if (event.key === "ArrowLeft") index = (index - 1 + tabs.length) % tabs.length;

		if ( index !== tabs.indexOf(event.target) ) {
			tabs[index].focus();
			this.selectTab(tabs[index]);
			event.preventDefault();
		}
	}

	selectTab(tab) {
		if (!tab) return;

		const tabButtons = this.getTabButtons();
		const tabButton = this.getTabButton(tab);

		if (!tabButton) return;

		// Deselect all tabs
		tabButtons.forEach(tab => tab.setAttribute("aria-selected", "false"));
		tabButton.setAttribute("aria-selected", "true");

		this.showSelectedPanel();

	}

	//Show only selected panel
	showSelectedPanel() {
		const tabButton = this.element.querySelector("[role=tab][aria-selected=true]");
		const panels = this.getPanels();
		
		if ( tabButton.getAttribute("data-tabs-all") === "true" ) {
			panels.forEach(
				panel => panel.hidden = false
			);
			return;
		} else {
			panels.forEach(
				panel => panel.hidden = (
					!tabButton
					||
					panel.id !== tabButton.getAttribute("aria-controls")
				)
			);
		}

	}

	getTabButton(name) {

		// If it's already an element, return it
		if (name instanceof HTMLElement) return name;

		const tabButtons = this.getTabButtons();

		for ( const tab of tabButtons ) {
			const tabName =
			tab.getAttribute("data-tabs-name") ||
			tab.getAttribute("data-name") ||
			tab.textContent.trim();

			if (tabName === name) return tab;
		}
		return null; // not found
	}

	getTopLevelElements(selector) {
		const all = Array.from(this.element.querySelectorAll(selector));
		return all.filter(el => !all.some(other => other !== el && other.contains(el)));
	}

	getPanels() {
		return this.getTopLevelElements("[role=tabpanel]");
	}

	getTabButtons() {
		return this.getTopLevelElements("[role=tab]");
	}

	getTabButtons() {
		return this.element.querySelectorAll(':scope > [role="tablist"] > [role="tab"]');
	}


});
