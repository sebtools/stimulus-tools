window.addEventListener('custom-event', (event) => {
	console.log('Custom event triggered!');
});
function triggerCustomEvent() {
	const event = new CustomEvent('custom-event', {
		detail: {
			message: 'Hello from the custom event!'
		}
	});
	window.dispatchEvent(event);
}