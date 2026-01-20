application.register('styler', class extends Stimulus.Controller {
	static targets = ["source", "target"]

	connect() {
		this.observeTargetAttribute()
		this.updateFromSource()
		this.bindSourceEvents()
	}

	// --- Event handling ---
	bindSourceEvents() {
		if (!this.hasSourceTarget) return;

		const source = this.sourceTarget;

		if (source.tagName === "SELECT") {
			source.addEventListener("change", () => this.updateFromSource())
		} else if (source.querySelectorAll("input[type='radio']").length) {
			source.querySelectorAll("input[type='radio']").forEach(radio => {
				radio.addEventListener("change", () => this.updateFromSource())
			})
		}
		
		// Also listen for programmatic changes from other controllers
		// Use event delegation on the element (table cell) to catch change events
		this.element.addEventListener("change", (event) => {
			// Only respond if the changed element is our source target
			if (event.target === this.sourceTarget) {
				this.updateFromSource()
			}
		});

	}

	// --- Core logic ---
	updateFromSource() {
		let newStyles = ""

		if (this.sourceTarget.tagName === "SELECT") {
			const selectedOption = this.sourceTarget.selectedOptions[0]
			if (selectedOption) newStyles = selectedOption.dataset.styles || ""
		} else {
			const checkedRadio = this.sourceTarget.querySelector("input[type='radio']:checked")
			if (checkedRadio) newStyles = checkedRadio.dataset.styles || ""
		}

		this.targetTarget.dataset.styles = newStyles
	}

	observeTargetAttribute() {
		if (!this.hasTargetTarget) return

		this.observer = new MutationObserver(mutations => {
			for (const mutation of mutations) {
				if (mutation.type === "attributes" && mutation.attributeName === "data-styles") {
				this.applyTargetStyles(mutation.oldValue, this.targetTarget.dataset.styles)
				}
			}
		})

		this.observer.observe(this.targetTarget, {
			attributes: true,
			attributeFilter: ["data-styles"],
			attributeOldValue: true,
		})
	}

	applyTargetStyles(oldStyles, newStyles) {
		const el = this.targetTarget
		const currentStyle = el.getAttribute("style") || ""

		// Remove old styles (if any)
		let cleaned = currentStyle
		if (oldStyles) {
			const oldRules = oldStyles.split(";").map(s => s.trim()).filter(Boolean)
			for ( const rule of oldRules ) {
				const prop = rule.split(":")[0]?.trim()
				const regex = new RegExp(`${prop}\\s*:[^;]*;?`, "gi")
				cleaned = cleaned.replace(regex, "")
			}
		}

		// Add new styles
		if ( newStyles ) {
			cleaned = cleaned.trim();
		if ( cleaned && !cleaned.endsWith(";") ) cleaned += ";"
			cleaned += " " + newStyles;
		}

		el.setAttribute("style", cleaned.trim())
	}

	disconnect() {
		if (this.observer) this.observer.disconnect()
	}
});
