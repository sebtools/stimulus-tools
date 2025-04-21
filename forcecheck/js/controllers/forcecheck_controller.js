application.register('forcecheck', class extends Stimulus.Controller {

	initialize() {

		this.dispatch("initialized");

	}

	connect() {

		this.config();

		//Attaching controller to object so we can call methods on it.

		this.element[this.identifier] = this;

		this.dispatch("connected");

	}

	disconnect() {

		this.dispatch("disconnected");

	}

	config() {

		this.enforceCheckStates();

		this.element.addEventListener("change", this.preventChange.bind(this));

	}

	enforceCheckStates() {

		this.element.querySelectorAll("input[type='checkbox'][data-forcecheck-force]").forEach((checkbox) => {

			this.force(checkbox,false);

		});

	}

	preventChange(event) {

		this.force(event.target,true);

	}

	force(checkbox,doAlert=false) {

		const forceValue = checkbox.getAttribute("data-forcecheck-force");

		if ( forceValue === "true" || forceValue === "false" ) {

			checkbox.checked = (  forceValue === "true" );

			//Show an alert if requested and if there is one to show.
			if ( doAlert ) {
				let alertMessage = checkbox.getAttribute("data-forcecheck-alert");
				if ( !alertMessage ) {
					alertMessage = this.element.getAttribute("data-forcecheck-alert");
				}
				if ( alertMessage ) {
					alert(alertMessage);
				}
			}
			this.dispatch("forced", { target: checkbox, forceValue: forceValue });

		}

	}

})

