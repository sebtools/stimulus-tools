application.register('checkall', class extends Stimulus.Controller {
	static targets = ["all", "checkbox"];

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

		this.updateAllChecked();

		// Ensure the "all" target has a data-action attribute
		if ( !this.allTarget.hasAttribute("data-action") ) {
			this.allTarget.setAttribute("data-action", "change->checkall#toggleAll");
		}

	}

	disconnect() {

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

	checkAll() {

		this.allTarget.checked = this.checkboxTargets.every(checkbox => checkbox.checked = true);

		this.toggleAll();

	}

	uncheckAll() {

		this.allTarget.checked = this.checkboxTargets.every(checkbox => checkbox.checked = false);

		this.toggleAll();
		
	}

	toggleAll() {

		this.dispatch("toggling");

		this.checkboxTargets.forEach(checkbox => {
			checkbox.checked = this.allTarget.checked;
			this.dispatch("checkboxToggled", { target: checkbox });
		});
		
		this.dispatch("toggled");
	}

	updateAllChecked() {
		this.allTarget.checked = this.checkboxTargets.every(checkbox => checkbox.checked);
	}

})