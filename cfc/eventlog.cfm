<cfset oWidgets = createObject("component", "widgets")>
<cfset qWidgets = oWidgets.getWidgets()>

<!DOCTYPE HTML>
<html>
<head>
	<title>CFC Controller EventLog Example</title>
	<meta http-equiv="Content-Type" content="text/html;charset=utf-8" >
	<link rel="stylesheet" href="../eventlog/eventlog.css">
</head>
<body>

<h1>CFC Controller EventLog Example</h1>

<div
	data-controller="cfc"
	data-cfc-path="widgets.cfc"
	data-cfc-args="fruit=apples"
	data-cfc-columns='{"WidgetID":{"name":"id","type":"int"},"WidgetName":"name","WidgetExtra":{}}'
>
	<button type="button" data-action="click->cfc#call" data-cfc-method="getWidgets">Call Method</button>

	<!-- No receiver here; results will be delivered by events and logged by the EventLog controller -->
</div>

<!-- EventLog controller instance: listens for CFC controller events and shows them -->
<div
	data-controller="eventlog"
	data-eventlog-events="cfc:fetching cfc:fetched"
	style="position:fixed; right:16px; bottom:16px; width:420px; max-height:45vh; z-index:9999; display:flex; flex-direction:column;"
>
	<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
		<strong style="font-size:13px;">EventLog</strong>
		<button type="button" data-action="eventlog#clear" style="font-size:12px;padding:4px 8px;">Clear</button>
	</div>
	<div data-eventlog-target="output" style="min-height:200px; border:1px solid #ddd; padding:10px; background:white; overflow:auto; flex:1;">
	</div>
</div>

<script src="../js/stimulus.js"></script>
<script src="../js/app.js"></script>
<script src="js/controllers/cfc_controller.js"></script>
<script src="../eventlog/js/controllers/eventlog_controller.js"></script>

</body>
</html>
