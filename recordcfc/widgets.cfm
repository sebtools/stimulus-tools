<cfset oWidgets = createObject("component", "widgets")>
<cfset qWidgets = oWidgets.getWidgets()>


<!DOCTYPE HTML>

<html>
<head>
	<title>Widgets</title>
	<meta http-equiv="Content-Type" content="text/html;charset=utf-8" >
	<link rel="stylesheet" href="themer/themes.css">
	<link rel="stylesheet" href="widgets.css">
	<script src="widgets.js"></script>
</head>

<body>


<form class="widgetForm" method="post" action="widgets.cfc?method=submit">
	<h2>Widgets: Plain Form</h2>
	<table class="widgetTable">
		<thead>
			<tr>
				<th>Name</th>
				<th>Extra</th>
			</tr>
		</thead>
		<tbody>
		<cfoutput query="qWidgets">
			<tr><input type="hidden" name="widgetID_#CurrentRow#" value="#WidgetID#">
				<td>
					<input name="widgetName_#CurrentRow#" value="#WidgetName#">
				</td>
				<td>
					<input name="widgetExtra_#CurrentRow#" value="#WidgetExtra#">
				</td>
			</tr>
		</cfoutput>
		<cfset CurrentRow = qWidgets.RecordCount + 1>
		<cfoutput>
			<tr>
				<td>
					<input name="widgetName_#CurrentRow#" value="">
				</td>
				<td>
					<input name="widgetExtra_#CurrentRow#" value="">
				</td>
			</tr>
		</cfoutput>
		</tbody>
	</table>
	<button type="submit">Submit</button>
</form>



<form class="widgetForm" method="post" action="widgets.cfc?method=submit">
	<h2>Widgets: CFC Controller</h2>
	<table
		class="widgetTable"
		data-controller="cfc"
		data-cfc-path="widgets.cfc"
	>
		<thead>
			<tr>
				<th>Name</th>
				<th>Extra</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
		<cfoutput query="qWidgets">
			<tr data-cfc-method="saveWidget"><input type="hidden" data-cfc-arg="WidgetID" name="widgetID_#CurrentRow#" value="#WidgetID#">
				<td>
					<input data-cfc-arg="WidgetName" name="widgetName_#CurrentRow#" value="#WidgetName#">
				</td>
				<td>
					<input data-cfc-arg="WidgetExtra" name="widgetExtra_#CurrentRow#" value="#WidgetExtra#">
				</td>
				<td class="actions">
					<button type="button" data-action="click->cfc##call">Save</button>
				</td>
			</tr>
		</cfoutput>
		<cfset CurrentRow = qWidgets.RecordCount + 1>
		<cfoutput>
			<tr data-cfc-method="saveWidget">
				<td>
					<input data-cfc-arg="WidgetName" name="widgetName_#CurrentRow#" value="">
				</td>
				<td>
					<input data-cfc-arg="WidgetExtra" name="widgetExtra_#CurrentRow#" value="">
				</td>
				<td class="actions">
					<button type="button" data-action="click->cfc##call">Save</button>
				</td>
			</tr>
		</cfoutput>
		</tbody>
	</table>
	<button type="submit">Submit</button>
</form>



<form class="widgetForm" method="post" action="widgets.cfc?method=submit">
	<h2>Widgets: Record CFC Controller</h2>
	<table
		class="widgetTable"
		data-controller="record cfc recordcfc"

		data-cfc-path="widgets.cfc"

		data-recordcfc-method-save="saveWidget"
		data-recordcfc-method-delete="removeWidget"
		data-recordcfc-idarg="WidgetID"

	>
		<thead>
			<tr>
				<th>Name</th>
				<th>Extra</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
		<cfoutput query="qWidgets">
			<input type="hidden" name="widgetID_#CurrentRow#" value="#WidgetID#">
			<tr data-record-id="#WidgetID#">
				<td>
					<input data-record-field="WidgetName" name="widgetName_#CurrentRow#" value="#WidgetName#">
				</td>
				<td>
					<input data-record-field="WidgetExtra" name="widgetExtra_#CurrentRow#" value="#WidgetExtra#">
				</td>
				<td class="actions">
					<button type="button" data-action="record##deleteRecord">Delete</button>
				</td>
			</tr>
		</cfoutput>
		<cfset CurrentRow = qWidgets.RecordCount + 1>
		<cfoutput>
			<tr data-record-id="">
				<td>
					<input data-cfc-arg="WidgetName" name="widgetName_#CurrentRow#" value="">
				</td>
				<td>
					<input data-cfc-arg="WidgetExtra" name="widgetExtra_#CurrentRow#" value="">
				</td>
			</tr>
		</cfoutput>
		</tbody>
	</table>
	<button type="submit">Submit</button>
</form>

<!---
Thoughts on a custom tag

<cf_mForm class="widgetForm" method="post" action="widgets.cfc?method=submit"
	m_cfc_path="widgets.cfc"
	m_method_save="saveWidget"
>
	<h2>Widgets: Record CFC Controller</h2>
	<table class="widgetTable">
		<thead>
			<tr>
				<th>Name</th>
				<th>Extra</th>
			</tr>
		</thead>
		<tbody>
			<cf_mRecord query="qWidgets" tag="tr" m_id="WidgetID">
				<td>
					<cf_mRecordField m_field="WidgetName" tag="input">
				</td>
				<td>
					<cf_mRecordField m_field="WidgetExtra" tag="input">
				</td>
			</cf_mRecord>
		</tbody>
	</table>
	<button type="submit">Submit</button>
</cf_mForm>
--->

<!-- EventLog controller instance (renders last events) -->
<div
	data-controller="eventlog"
	data-eventlog-events="cfc:calling cfc:called record:ui:dirty record:ui:add record:ui:update record:ui:delete record:ui:query record:ui:loaded record:ui:added record:ui:updated record:ui:sorted record:gather-data record:data:update record:data:add record:data:delete record:data:load record:data:error:update record:data:error:add record:data:error:delete record:data:error:load"
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
<script src="../cfc/js/controllers/cfc_controller.js"></script>
<script src="../record/js/controllers/record_controller.js"></script>
<script src="js/controllers/recordcfc_controller.js"></script>

</body>
</html>