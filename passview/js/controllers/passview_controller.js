const DEFAULT_PATH = "";
const DEFAULT_ICON_OPEN = "eye.svg"
const DEFAULT_ICON_CLOSED = "eye-slash.svg"

application.register('passview', class extends Stimulus.Controller {
	static values = {
		iconOpen: String,
		iconClosed: String,
		path: String
	}

	initialize() {
		this.dispatch("initialized");
	}

	connect() {

		if ( !this._initialized ) {
			this.injectStyles()
			this.setupWrapper()
			this._initialized = true
		}

		//Attaching controller to object so we can call methods on it.
		this.element[this.identifier] = this;
		
		this.dispatch("connected");

	}

	disconnect() {
		this.dispatch("disconnected");
	}

	setupWrapper() {
		// Wrap input
		const wrapper = document.createElement("div");
		wrapper.setAttribute("data-passview-wrapper","true");

		// Move the input inside wrapper
		this.element.parentNode.insertBefore(wrapper, this.element);
		wrapper.appendChild(this.element);

		// Create toggle button
		this.button = document.createElement("button");
		this.button.type = "button";
		this.button.setAttribute("data-passview-target","button");
		this.button.addEventListener("click", () => this.toggle());

		// Create icon
		this.icon = document.createElement("img");
		this.icon.src = this._iconOpenPath();
		this.icon.alt = "Show password";

		this.button.appendChild(this.icon);
		wrapper.appendChild(this.button);

		this.updatePressed();

	}

	injectStyles() {
		if ( document.getElementById("passview-styles") ) return;

		const link = document.createElement("link");
		link.id = "passview-styles";
		link.rel = "stylesheet";
		link.href = this._basePath() + "css/passview.css"; // must be resolvable by the browser
		document.head.appendChild(link);
	}


	toggle() {
		const isPassword = this.element.type === "password"
		this.element.type = isPassword ? "text" : "password"

		this.icon.src = isPassword ? this._iconClosedPath() : this._iconOpenPath()
		this.icon.alt = isPassword ? "Hide password" : "Show password"

		this.updatePressed();
		
		this.dispatch("toggled", { target: this.element, visible: !isPassword })
	}

	updatePressed() {
		const isPassword = this.element.type === "password"
		this.button.setAttribute("aria-pressed", (!isPassword).toString());
	}

	// --- helpers ---
	_basePath() {
		return this.hasPathValue ? this.pathValue : this._getCurrFolderPath() || DEFAULT_PATH;
	}

	_getCurrFolderPath() {
		const script = document.currentScript || Array.from(document.scripts).find(s => s.src.includes('passview_controller.js'));
		let currPath = null;

		if ( script && script.src ) {
			const url = new URL(script.src, window.location.origin);
			currPath = url.pathname.replace(/[^\/]+$/, '');
		}

		return currPath;
	}

	_iconOpenPath() {
		return this.hasIconOpenValue
		? this.iconOpenValue
		: `${this._basePath()}img/${DEFAULT_ICON_OPEN}`
	}

	_iconClosedPath() {
		return this.hasIconClosedValue
		? this.iconClosedValue
		: `${this._basePath()}img/${DEFAULT_ICON_CLOSED}`
	}

})