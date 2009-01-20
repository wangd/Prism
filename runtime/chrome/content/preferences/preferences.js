Components.utils.import("resource://prism-runtime/modules/WebAppProperties.jsm");

var WebRunnerPrefs =
{
  init : function() {
    var prefXUL = WebAppProperties.getAppRoot();
    prefXUL.append("preferences");
    prefXUL.append("prefs.xul");

    if (prefXUL.exists()) {
      var prefPane = document.createElement("prefpane");
      prefPane.id = "paneWebApp";
      prefPane.setAttribute("label", WebAppProperties.name);
      prefPane.src = "resource://webapp/preferences/prefs.xul";
      prefPane.image = "resource://webapp/preferences/prefs.png";
      
      var prefWindow = document.getElementById("BrowserPreferences");
      prefWindow.addPane(prefPane);
    }
  }
};
