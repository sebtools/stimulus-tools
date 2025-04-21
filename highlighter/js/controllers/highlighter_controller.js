application.register('highlighter', class extends Stimulus.Controller {

	initialize() {
		
		this.dispatch("initialize");
	}

	connect() {

		this.checkStyle();
		
		this.highlightWords();
		this._setMutationObserver();

		//Attaching controller to object so we can call methods on it.
		this.element[this.identifier] = this;

		this.dispatch("connected");

	}

	disconnect() {

		// Remove the mutation observer when the controller is disconnected
		if ( this.mutationObserver ) {
			this.mutationObserver.disconnect();
		}
		
		this.dispatch("disconnected", {
			target: this.element,
			words: this.getWordsString()
		});

	}

	addWord(word) {
		const words = this.getWordsArray();
		words.push(word);
		this.setWordsArray(words);
		//this.highlightWords();
	}

	getHighlightClass() {
		const result = this.element.getAttribute("data-highlight-class") || "highlight";
		
		return result;
	}

	getHighlightColor() {
		const result = this.element.getAttribute("data-highlight-color") || "yellow";
		
		return result;
	}

	getWordsArray() {
		const result = this.getWordsString().trim();
		var words = result.split(' ');

		// Remove empty strings from the array
		words = words.filter(word => word.trim() !== '');

		return words;
	}

	getWordsString() {
		const result = this.element.getAttribute("data-highlighter-words") || " ";
		
		return result;
	}

	highlightWords() {
		const words = this.getWordsArray();
		let content = this.element.innerHTML;
		const highlightClass = this.getHighlightClass();

		if ( words.length == 0 ) {
			return;
		}

		this.busy(true);

		words.forEach(word => {
			const regex = new RegExp(`\\b${word}\\b`, 'gi');
			content = content.replace(regex, `<span class="${highlightClass}">${word}</span>`);
		});

		this.element.innerHTML = content;

		this.busy(false);

		this.dispatch("highlighted", {
			target: this.element,
			words: this.getWordsString()
		});
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

	// I check to see if the highlight class is applied to the element.
	checkStyle() {
		const oSample = document.createElement('span');
		oSample.className = this.getHighlightClass();
		document.body.appendChild(oSample);
		const hasStyle = ( window.getComputedStyle(oSample).cssText !== '' );
		document.body.removeChild(oSample);

		// If no style exists for the class, then create one that applied only within the controller with just the background color.
		if ( !hasStyle ) {
			const style = document.createElement('style');

			style.innerHTML = `[data-controller~="highlighter"] .${this.getHighlightClass()} { background-color: ${this.getHighlightColor()}; }`;
			document.head.appendChild(style);
		}

	}

	setHighlightClass(className) {

		this.element.setAttribute("data-highlight-class",className);
		
	}

	setHighlightColor(color) {

		this.element.setAttribute("data-highlight-color",color);
		
	}

	setWordsArray(words) {

		this.setWordsString(words.join(' '));
		
	}

	setWordsString(words) {

		this.element.setAttribute("data-highlighter-words", words);
		
	}

	_setMutationObserver() {

		this.mutationObserver = new MutationObserver(() => {
			this.highlightWords();
		});
		
		// If the content is changed, we need to rehighlight the words
		this.mutationObserver.observe(this.element, { childList: true, subtree: true });

		// If the words are changed, we need to rehighlight the words
		this.mutationObserver.observe(this.element, { attributes: true, attributeFilter: ['data-highlighter-words'] });

	}

});