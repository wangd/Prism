//const Cc = Components.classes;
//const Ci = Components.interfaces;

//Components.utils.import("resource://app/modules/WebAppInstall.jsm");

var options = {
	title : null,
	uri : null,
	id : null,
	icon : null,
	status : null,
	location : null,
	sidebar : null,
	navigation : null,
	favicon_url : null,
};

function sync() {
	options.id = document.getElementById("id").value;
	options.title = document.getElementById("name").value;
	options.status = document.getElementById("opt_status").checked;
	options.location = document.getElementById("opt_location").checked;
	options.sidebar = document.getElementById("opt_sidebar").checked;
	options.navigation = document.getElementById("opt_navigation").checked;
}

function startup() {
	options.title = window.arguments[0];
	options.uri = window.arguments[1];
	options.favicon_url = window.arguments[2];

	document.getElementById("name").value = options.title;
	sync();
}

function chooseCustomIcon() {
	var xulRuntime = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime);
	var iconExt = "";
	var title = "";
	var os = xulRuntime.OS.toLowerCase();
	if (os == "winnt")
		iconExt = "*.ico";
	else if (os == "linux")
		iconExt = "*.xpm";
	else if (os == "darwin")
		iconExt = "*.icns";

	var fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
	fp.init(window, "Icon file", Ci.nsIFilePicker.modeOpen);
	fp.appendFilter("icon", iconExt);
	if (fp.show() == Ci.nsIFilePicker.returnOK) {
		document.getElementById("icon-preview").src = fp.file.path;
	}
}

function createApplication() {
	// sync with the UI
	sync();
	options.icon = "webrunner";

	let installer = new WebAppInstall();

	installer.createApplication(options);
	installer.createShortcut(options.title, options.id, options.icon)
}

function toggleAdvanced() {
	/* @todo put UI in a deck */
	let advance = document.getElementById("advanced_options");
	let shortcut = document.getElementById("shortcut");
	let icon = document.getElementById("icon");
	let button = document.getElementById("convertToApplication").getButton("extra1");

	advance.hidden = !advance.hidden;
	shortcut.hidden = !shortcut.hidden;
	icon.hidden = !icon.hidden;

	button.label = (advance.hidden ? "Advanced..." : "Simplify...");
}
