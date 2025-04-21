
application.register('history', class extends Stimulus.Controller {

	initialize() {
		this.dispatch("initialized");
	}

	connect() {
		this.dispatch("connected");
	}

	disconnect() {
		this.dispatch("disconnected");
	}

	back() {
		history.back();
	}

	forward() {
		history.forward();
	}

	go(event) {

		if ( event.target.hasAttribute("data-history-goval") ) {
			history.go(event.target.getAttribute("data-history-goval"));
		} else {
			history.go();
		}

	}

})
