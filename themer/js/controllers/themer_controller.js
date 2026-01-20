application.register('themer', class extends Stimulus.Controller {
	//static targets = [];

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

		// Set theme from localStorage if available
		this.setThemeFromStorage(this.element);

		// Create buttons for all themes
		this._createButtons();

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

	getCurrentTheme(element) {
		const target = this.getThemeElement(element);
		return target.hasAttribute("data-theme")
			? target.getAttribute("data-theme")
			: this.getDefaultTheme();
	}

	getDefaultTheme() {
		
		if ( window.matchMedia("(prefers-color-scheme: dark)").matches ) {
			return "dark";
		}

		return "light";
	}

	getThemeElement(element) {
		if ( !element ) {
			element = this.element;
		}

		if ( !(element instanceof Element) ) {
			throw new Error("getThemeElement expects a DOM element");
		}

		let el = element;
		// Look for nearest ancestor with data-theme attribute
		while ( el ) {
			if ( el.hasAttribute("data-theme") ) {
				return el;
			}
			el = el.parentElement;
		}

		// Always fallback to <html>
		return document.documentElement;
	}

	// Get the label for a theme (falls back to the theme name if not defined)
	getThemeLabel(theme) {
		let label = this.getThemeVariable(theme, "--theme-label");
		if (label) {
			// Remove quotes if the label was defined with them in CSS
			label = label.replace(/^["']|["']$/g, "");
			return label;
		}
		return theme;
	}

	// Get all defined themes and their labels
	getThemes() {
		const themes = [];

		for ( const sheet of document.styleSheets ) {
			try {
				for ( const rule of sheet.cssRules ) {
					if ( rule.selectorText?.startsWith('[data-theme="') ) {
						const match = rule.selectorText.match(/\[data-theme="(.+)"\]/);
						if ( match ) {
							const name = match[1];
							themes.push({ name, label: this.getThemeLabel(name) });
						}
					}
				}
			} catch (e) {
				// Ignore cross-origin stylesheets
			}
		}

		return themes;
	}

	// Get the value of a custom property for a given theme
	getThemeVariable(themeName, variableName) {
		for ( const sheet of document.styleSheets ) {
			try {
				for ( const rule of sheet.cssRules ) {
					if ( rule.selectorText === `[data-theme="${themeName}"]` ) {
						return rule.style.getPropertyValue(variableName).trim() || null;
					}
				}
			} catch (e) {
				// Ignore cross-origin stylesheets
			}
		}
		return null; // not found
	}

	set(event) {
		const button = event.currentTarget;
		const theme = button.dataset.theme;
		
		if ( theme ) {
			this.setTheme(theme, this.element);
		}

	}

	setTheme(theme, element) {
		const target = this.getThemeElement(element);
		
		target.setAttribute("data-theme", theme);
		localStorage.setItem('theme', theme);

		this.updateActiveButtonDiv();
		this.dispatch("theme-changed", { theme, element: target });
	}

	setThemeFromStorage(element) {
		const storedTheme = localStorage.getItem('theme');

		if ( !(element instanceof Element) ) {
			element = this.element;
		}
		
		if ( storedTheme ) {
			this.setTheme(storedTheme, element);
		}

	}


	_createButtons(element, themes) {
		if ( !(element instanceof Element) ) {
			element = this.element;
		}
		if ( !Array.isArray(themes) ) {
			themes = this.getThemes();
		}

		// Find longest label length
		const maxLength = Math.max(...themes.map(t => t.label.length)) * 1.2; // add some padding
		const width = `${maxLength}ch`;
		

		themes.forEach(theme => {
			const container = document.createElement("div");
			container.setAttribute("data-themer-target", "buttondiv");

			const button = document.createElement("button");
			button.type = "button";
			button.textContent = theme.label;
			button.dataset.theme = theme.name;
			//button.style.width = width; // enforce equal widths

			button.dataset.action = "themer#set";

			container.appendChild(button);
			element.appendChild(container);

		});

		this._createStyleBlock(maxLength);

		
		//return container;
	}

	_createStyleBlock(maxLength) {
		if (document.querySelector("#themer-styles")) return; // only inject once

		const style = document.createElement("style");
		style.id = "themer-styles";
		style.textContent = `
			div[data-controller="themer"] {
				max-height: 240px;
				overflow-x: hidden;
				overflow-y: auto; /* scroll if content exceeds max height */
				padding-right: 1.5em; /* space for scrollbar */
				width: max-content;
				margin-bottom: var(--spacing);
				1px solid var(--color-primary);
			}

			div[data-themer-target="buttondiv"] {
				border: 3px solid var(--color-primary);
				padding: 0.25em;
				margin: 0.25em 0;
				border-radius: 0.25em;
				width: max-content
			}

			div[data-themer-target="buttondiv"][aria-current="true"] {
				border-color: var(--color-accent);
			}

			div[data-themer-target="buttondiv"] > button {
				display: inline-block;
				width: ${maxLength}ch;
			}
		`;
		document.head.appendChild(style);
		
		this.updateActiveButtonDiv();

	}


	updateActiveButtonDiv() {
		const currentTheme = this.getCurrentTheme();
		const divs = this.element.querySelectorAll("div[data-themer-target='buttondiv']");

		divs.forEach(div => {
			const btn = div.querySelector("button[data-theme]")
			if ( btn && btn.dataset.theme === currentTheme ) {
				div.setAttribute("aria-current", "true")
			} else {
				div.removeAttribute("aria-current")
			}
		})
	}


})