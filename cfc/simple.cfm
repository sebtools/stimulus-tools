<cfset oWidgets = createObject("component", "widgets")>
<cfset qWidgets = oWidgets.getWidgets()>

<!DOCTYPE HTML>
<html>
<head>
	<title>CFC Controller Example</title>
	<meta http-equiv="Content-Type" content="text/html;charset=utf-8" >
	<link rel="stylesheet" href="../widgets.css">
</head>
<body>

<h1>CFC Controller Example (normalized response)</h1>

<div
	data-controller="cfc"
	data-cfc-path="../recordcfc/widgets.cfc"
	data-cfc-columns='{"WidgetID":{"name":"id","type":"int"},"WidgetName":"name","WidgetExtra":{}}'
	data-cfc-target="widgetsOutput"
>
	<button type="button" data-action="click->cfc#call" data-cfc-method="getWidgets">Load Widgets</button>

	<pre data-cfc-receiver="widgetsOutput"></pre>

</div>

<script src="../js/stimulus.js"></script>
<script src="../js/app.js"></script>
<script src="js/controllers/cfc_controller.js"></script>

</body>
</html>