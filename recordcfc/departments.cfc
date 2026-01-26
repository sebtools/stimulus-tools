<cfcomponent>
<cfscript>
Variables.DataMgr = CreateObject("component","com.sebtools.DataMgr").init("TestSQL");

public function init() {
	return This;
}

remote query function getDepartment(numeric DepartmentID=0) returnformat="json" {
	var qDepartments = Variables.DataMgr.getRecord(tablename="departments", data={DepartmentID=Arguments.DepartmentID});

	return qDepartments;
}

remote query function getDepartments() returnformat="json" {
	var qDepartments = Variables.DataMgr.getRecords("departments");

	return qDepartments;
}

remote query function getDepartmentsWithEmployees() returnformat="json" {
	var qDepartments = 0;

	qDepartments = QueryExecute(
		sql="
			SELECT	d.DepartmentID,
					d.DepartmentName,
					e.EmployeeID,
					e.EmployeeName
			FROM	departments d
			LEFT JOIN
					employees e
				ON	d.DepartmentID = e.DepartmentID
			ORDER BY
					d.DepartmentID ASC,
					e.EmployeeID ASC
		",
		options={datasource="TestSQL"}
	);

	return qDepartments;
}

remote string function removeDepartment(
	string DepartmentID
) returnformat="plain" {
	return Variables.DataMgr.deleteRecord(
		tablename="departments",
		data={DepartmentID=Arguments.DepartmentID}
	);
}

remote string function saveDepartment(
	string DepartmentName
) returnformat="plain" {

	return Variables.DataMgr.saveRecord(
		tablename="departments",
		data=Arguments
	);
}
</cfscript>

</cfcomponent>