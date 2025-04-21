function addOption() {
	var select = document.querySelector('select[name="choice"]');
	var newOptionText = document.getElementById('newOptionText').value;
	var newOptionValue = document.getElementById('newOptionValue').value;
	
	if (newOptionText && newOptionValue) {
		var newOption = document.createElement('option');
		newOption.text = newOptionText;
		newOption.value = newOptionValue;
		select.add(newOption);
	}
}