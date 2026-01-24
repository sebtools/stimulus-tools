<cfcomponent>
<cfscript>
Variables.DataMgr = CreateObject("component","com.sebtools.DataMgr").init("TestSQL");

public function init() {
	return This;
}

remote function getDepartment(numeric DepartmentID=0) returntype="query" output="false" returnformat="json" {
	var qDepartments = Variables.DataMgr.getRecord(tablename="departments", data={DepartmentID=Arguments.DepartmentID});

	return qDepartments;
}

remote function getDepartments() returntype="query" output="false" returnformat="json" {
	var qDepartments = Variables.DataMgr.getRecords("departments");

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