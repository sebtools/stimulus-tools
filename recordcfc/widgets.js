document.addEventListener('DOMContentLoaded', function() {
	document.querySelectorAll('.widgetForm').forEach(function(form) {
		actionButtons = form.querySelectorAll('.actions button');
		if ( actionButtons.length === 0 ) {
			return;
		}
		form.querySelector('button[type="submit"]').hidden = true;
		actionButtons.forEach(function(btn) {
			btn.style.display = 'inherit';
		});
	});

});