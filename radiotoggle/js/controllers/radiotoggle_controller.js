application.register('radiotoggle', class extends Stimulus.Controller {
	static targets = ["radio"];

	initialize() {
		this.dispatch("initialized");
	}

	connect() {

		// Initialize dataset for tracking values before click events.
		this.radioTargets.forEach(radio => {
			//Add click action to the radio button if it doesn't already have one
			if ( !radio.dataset.action ) {
				radio.dataset.action = "click->radiotoggle#toggle";
			}
			radio.dataset.checked = radio.checked;
		});

		this.dispatch("connected");

	}

	disconnect() {

		this.dispatch("disconnected");

	}

	toggle(event) {
		const radio = event.target;
		
		//The dataset value represents the state of the radio button before the event

		if ( radio.checked && radio.dataset.checked === "true" ) {
			
			radio.checked = false;
			radio.dataset.checked = "false";

			this.dispatch("toggled", { detail: { target: radio, checked: false } });

		} else {
			
			this.radioTargets.forEach(r => r.dataset.checked = "false");
			radio.dataset.checked = "true";
			
			this.dispatch("toggled", { detail: { target: radio, checked: true } });

		}
	}

})