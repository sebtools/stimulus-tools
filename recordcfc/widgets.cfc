<cfcomponent>

<cfset Variables.DataMgr = CreateObject("component","com.sebtools.DataMgr").init("TestSQL")>

<cfscript>
public function init() {
	return This;
}

remote function getWidget(numeric WidgetID=0) returntype="query" output="false" returnformat="json" {
	var qWidgets = Variables.DataMgr.getRecord(tablename="Widgets", data={WidgetID=Arguments.WidgetID});
	
	return qWidgets;
}

remote function getWidgets() returntype="query" output="false" returnformat="json" {
	var qWidgets = Variables.DataMgr.getRecords("Widgets");
	
	return qWidgets;
}

remote string function removeWidget(
	string WidgetID
) returnformat="plain" {
	return Variables.DataMgr.deleteRecord(
		tablename="Widgets",
		data={WidgetID=Arguments.WidgetID}
	);
}

remote string function saveWidget(
	string WidgetName,
	string WidgetExtra,
	string WidgetID
) returnformat="plain" {

	/*
	writeLog(
		file="widget",
		text=SerializeJSON(Arguments)
	)
	*/
	
	return Variables.DataMgr.saveRecord(
		tablename="Widgets",
		data=Arguments
	);
}

remote function submit() {
	var qWidgets = getWidgets();
	var sWidget = 0;

	for ( var num=1; num LTE ( qWidgets.recordcount + 1 ); num++ ) {
		if (
			StructKeyExists(Arguments,"widgetName_#num#")
			AND
			Len(Trim(Arguments["widgetName_#num#"]))
		) {
			sWidget = {
				"WidgetID" = StructKeyExists(Arguments,"widgetID_#num#") ? Arguments["widgetID_#num#"] : 0,
				"WidgetName" = Arguments["widgetName_#num#"],
				"WidgetExtra" = Arguments["widgetExtra_#num#"]
			};
			saveWidget(ArgumentCollection=sWidget);
		}
	}

	// Do something with each widget
	location(url="widgets.cfm");

}
</cfscript>

</cfcomponent>