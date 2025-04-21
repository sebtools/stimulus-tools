application.register('formprogress', class extends Stimulus.Controller {
	static targets = ["progress"];

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

		// Remove the mutation observer when the controller is disconnected
		if ( this.observer ) {
			this.observer.disconnect();
		}

		this.dispatch("disconnected");

	}

	config() {

        this._addListeners();
        this._addMutationListeners();

        // Initialize progress on page load
        this.setProgress();
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

    getProgress() {
        const form = this.element;
        const requiredFields = new Set();
        let filledCount = 0;
    
        form.querySelectorAll('[required]').forEach(field => {
            
            // Skip hidden fields
            if ( field.offsetParent === null ) {
                return;
            }

            if ( field.tagName === "FIELDSET" ) {
                // Add fieldset itself to the count
                requiredFields.add(field);
    
                // Check if at least one checkbox/radio inside is checked
                const inputs = field.querySelectorAll("input[type='checkbox'], input[type='radio']");
                if ( Array.from(inputs).some(input => input.checked) ) {
                    filledCount++;
                }
            } else if (field.type === 'checkbox' || field.type === 'radio') {
                if ( !requiredFields.has(field.name) ) {
                    requiredFields.add(field.name);
    
                    // Check if at least one radio/checkbox with the same name is checked
                    if ( form.querySelector(`input[name="${field.name}"]:checked`) ) {
                        filledCount++;
                    }
                }
            } else {
                requiredFields.add(field);
    
                // Check if the field has a value
                if ( field.value.trim() !== "" ) {
                    filledCount++;
                }
            }

        });

        const percent = Math.round(filledCount / requiredFields.size * 100);
    
        return {
            value: filledCount,
            max: requiredFields.size,
            label: `${percent}%`
        };
    }

    setProgress() {
        const oTarget = this.progressTarget;
        
        this.busy(true);

        const progress = this.getProgress();

        // Update progress bar if the values have changed (to avoid unnecessary repaints and prevent possible infinite loops)

        if ( oTarget.value != progress.value ) {
            oTarget.value = progress.value;
        }
        if ( oTarget.max != progress.max ) {
            oTarget.max = progress.max;
        }
        if ( oTarget.innerHTML != progress.label ) {
            oTarget.innerHTML = progress.label;
        }

        this.busy(false);

        this.dispatch("progressed", {
            detail: progress
        });

    }

    _addListeners() {
        const form = this.element;

        // Listen for changes in the form field values
        form.querySelectorAll('input, select, textarea').forEach(field => {
            field.addEventListener('input', () => this.setProgress());
        });
    
    }

    _addMutationListeners() {
		this.observer = new MutationObserver(() => {
			this.setProgress();
		});
		
		// Any change to the form will reset the progress
		this.observer.observe(this.element, {
			childList: true,
			subtree: true
		});
		this.observer.observe(this.element, {
			attributes: true,
			attributeFilter: ['style'],
			subtree: true
		});

		// Any change to the progress bar will reset the progress
		this.observer.observe(this.progressTarget, {
			attributes: true,
			attributeFilter: ['value', 'max']
		});

		// Any change to the form's required fields will reset the progress
		this.element.querySelectorAll('[required]').forEach(field => {
			this.observer.observe(field, {
				attributes: true,
				attributeFilter: ['required']
			});
		});

		// Any change to the form's fieldsets will reset the progress
		this.element.querySelectorAll('fieldset').forEach(fieldset => {
			this.observer.observe(fieldset, {
				attributes: true,
				attributeFilter: ['disabled', 'hidden', 'style', 'aria-hidden', 'required'],
			});
		});
		
	}

})