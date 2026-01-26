<cfcomponent>

<cfscript>
Variables.DataMgr = CreateObject("component","com.sebtools.DataMgr").init("TestSQL");

public function init() {
	return This;
}

remote function getEmployee(numeric EmployeeID=0) returntype="query" output="false" returnformat="json" {
	var qEmployees = Variables.DataMgr.getRecord(tablename="employees", data={EmployeeID=Arguments.EmployeeID});
	
	return qEmployees;
}

remote function getEmployees() returntype="query" output="false" returnformat="json" {
	var qEmployees = Variables.DataMgr.getRecords(
		tablename="employees",
		data=Arguments,
		orderby="DepartmentID ASC, EmployeeID ASC"
	);

	return qEmployees;
}

remote string function removeEmployee(
	string EmployeeID
) returnformat="plain" {
	return Variables.DataMgr.deleteRecord(
		tablename="employees",
		data={EmployeeID=Arguments.EmployeeID}
	);
}

remote string function saveEmployee(
	string EmployeeName,
	numeric DepartmentID
) returnformat="plain" {
	
	return Variables.DataMgr.saveRecord(
		tablename="employees",
		data=Arguments
	);
}
</cfscript>

</cfcomponent>