document.addEventListener('tablefilter:filtered', function(event) {
	const listener = document.querySelector('#listener');

	if ( listener && !listener.querySelector('ul') ) {
		const ul = document.createElement('ul');
		listener.appendChild(ul);
	}

	const ul = listener.querySelector('ul');
	const li = document.createElement('li');
	li.textContent = new Date().toLocaleString();
	ul.appendChild(li);

});