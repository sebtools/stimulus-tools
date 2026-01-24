<cfset URL.id = 1>
<cfset oWidgets = CreateObject("component", "cfc.widgets").init()>
<cfset qWidget = oWidgets.getWidget(URL.id)>

<!doctype html>
<html>
<head>
	<meta charset="utf-8">
	<title>Record — Single Form Demo</title>
	<link rel="stylesheet" href="../theme.css">
	<link rel="stylesheet" href="../record/common.css">
</head>
<body>

	<h1>Record - Single Form Demo</h1>

	<p>A minimal demo that shows a single editable record (one table) using the <code>record</code> controller.
	The page also includes an <code>eventlog</code> so you can see the events the controller emits. No extra JavaScript is required.</p>

	<div style="display:flex; gap:24px; align-items:flex-start;">

		<div style="flex:1; min-width:320px;">
			<h2>Record Editor</h2>

		<cfoutput query="qWidget">
			<!-- Controller: a single table scope with one editable record -->
			<form
				action="../cfc/widgets.cfc?method=saveWidget"
				method="post"

				data-controller="record cfc recordcfc"

				data-record-table="widgets"
				data-record-id="#URL.id#"

				data-cfc-path="../cfc/widgets.cfc"

				data-recordcfc-idarg="WidgetID"
				data-recordcfc-method-save="saveWidget"

				style="display:grid; gap:8px;"
			>
				<input type="hidden" name="WidgetID" value="#WidgetID#">

				<label>Name
					<input type="text" name="WidgetName" data-record-field="WidgetName" value="#WidgetName#" />
				</label>

				<label>Extra
					<textarea name="notes" data-record-field="WidgetExtra">#WidgetExtra#</textarea>
				</label>

				<div style="display:flex; gap:8px;">
					<button type="submit" data-action="record##saveRecord">Save</button>
				</div>
			</form>
		</cfoutput>
		</div>

		<div style="width:380px;">
			<h2>Event Log</h2>
			<!-- EventLog listens for a set of record-related events and prints them -->
			<div
				data-controller="eventlog"
				data-eventlog-events="record:ui:added record:ui:added record:ui:add record:ui:update record:ui:updated record:ui:delete record:ui:deleted record:ui:dirty record:ui:loaded cfc:calling cfc:called record:data:update record:data:add record:data:delete record:data:load record:data:error:update record:data:error:add record:data:error:delete record:data:error:load"
				data-eventlog-serialize-dom="element"
				style="min-height:240px; background:white; border:1px solid #e0e0e0; padding:10px; overflow:auto;">
			</div>
		</div>

	</div>

	<!-- Load Stimulus and the app bootstrap -->
	<script src="../js/stimulus.js"></script>
	<script src="../js/app.js"></script>

	<!-- Load controllers used on this page -->
	<script type="module" src="../record/js/controllers/record_controller.js"></script>
	<script type="module" src="../cfc/js/controllers/cfc_controller.js"></script>
	<script type="module" src="js/controllers/recordcfc_controller.js"></script>
	<script type="module" src="../eventlog/js/controllers/eventlog_controller.js"></script>

</body>
</html>
