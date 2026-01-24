<cfscript>
URL.id = StructKeyExists(URL, "id") ? URL.id : 1;
oDepartments = CreateObject("component", "departments").init();
oEmployees = CreateObject("component", "employees").init();
qDepartment = oDepartments.getDepartment(URL.id);
qEmployees = oEmployees.getEmployees(DepartmentID=URL.id);
</cfscript>

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

	<p>A minimal demo that shows a multiple editable records (one table) using the <code>record</code> controller.
	The page also includes an <code>eventlog</code> so you can see the events the controller emits. No extra JavaScript is required.</p>

	<div style="display:flex; gap:24px; align-items:flex-start;">

		<div style="flex:1; min-width:320px;">
			<h2>Record Editor</h2>
			<form
				method="post"
				data-controller="record cfc recordcfc"
			>
			
				<input type="hidden" name="DepartmentID" value="#DepartmentID#">
				<div
					data-record-table="departments"
					data-record-id="1"
					data-cfc-path="departments.cfc"
					data-recordcfc-idarg="DepartmentID"
					data-recordcfc-method-save="saveDepartment"
					data-recordcfc-method-delete="removeDepartment"
				>
					<h2>Department</h2>

					<cfoutput query="qDepartment">
					<label>
						Department Name:<br>
						<input type="text" name="DepartmentName" data-record-field="DepartmentName" value="#DepartmentName#">
					</label>
					<button type="button" data-action="record##saveRecord">Save Department</button>
					</cfoutput>

					<table
						data-record-table="employees"
						data-record-auto-add="true"
						data-cfc-path="employees.cfc"
						data-recordcfc-idarg="EmployeeID"
						data-recordcfc-method-save="saveEmployee"
						data-recordcfc-method-delete="removeEmployee"
					>
						<thead>
							<tr>
								<th>Employee Name</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
						<cfoutput query="qEmployees">
							<input type="hidden" name="EmployeeID_#CurrentRow#" value="#EmployeeID#">
							<tr data-record-id="#EmployeeID#">
								<td><input type="text" name="EmployeeName_#CurrentRow#" data-record-field="EmployeeName" value="#EmployeeName#" /></td>
								<td>
									<input type="hidden" name="DepartmentID_#qEmployees.CurrentRow#" data-record-field="DepartmentID" value="#URL.id#">
									<button type="button" data-action="record##saveRecord">Save</button>
									<button type="button" data-action="record##deleteRecord">Delete</button>
								</td>
							</tr>
						</cfoutput>
						<cfoutput>
							<tr data-record-id="">
								
								<td><input type="text" name="EmployeeName_#qEmployees.RecordCount+1#" data-record-field="EmployeeName" value="" /></td>
								<td>
									<input type="hidden" name="DepartmentID_#qEmployees.RecordCount+1#" data-record-field="DepartmentID" value="#URL.id#">
									<button type="button" data-action="record##saveRecord">Save</button>
									<button type="button" data-action="record##deleteRecord">Delete</button>
								</td>
							</tr>
						</cfoutput>
						</tbody>
					</table>
				</div>
			</form>
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
