<cfset oChecker = createObject("component","checker").init()>

<!DOCTYPE html>
<html>
<head>
	<title>CFC Controller: Validate</title>
</head>
<body>

<h1>CFC Controller: Validate</h1>

<p>This example demonstrates using the CFC controller with a small custom JavaScript to show or hide elements based on the username validity.</p>

<p>A valid username is at least three characters long and isn't "admin" or "root".</p>

<div
	data-controller="cfc"
	data-cfc-name="checker"
	data-cfc-method="isValidUsername"
>
	<input id="testfield" name="testfield" type="text" data-cfc-arg="username">
	<button type="button" data-action="click->cfc#call">Check Username</button>
</div>

<cfoutput>
<div data-valid="true" hidden>#oChecker.getUsernameValidityMessage(true)#</div>
<div data-valid="false" hidden>#oChecker.getUsernameValidityMessage(false)#</div>
</cfoutput>

<script src="../js/stimulus.js"></script>
<script src="../js/app.js"></script>
<script src="js/controllers/cfc_controller.js"></script>
<script>
window.addEventListener("cfc:called", function(e) {
	// Normalize the response to a string so we can match the data-valid attribute
	const result = String(e.detail.result);

	// Only proceed for desired CFC method
	if ( !(e.detail.path === "checker.cfc" && e.detail.method === "isValidUsername") ) {
		return;
	}

	// Hide all elements that have a data-valid attribute except the one that matches the result
	document.querySelectorAll('[data-valid]').forEach(function(elem) {
		elem.hidden = (elem.getAttribute('data-valid') !== result);
	});

});
</script>

</body>
</html>