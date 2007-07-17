function Params(cl)
{
  if (!cl)
    return;

  // check for a webapp profile
  var file = cl.handleFlagWithParam("webapp", false);
  if (file)
    file = cl.resolveFile(file);

  // check for an OSX launch    
  if (!file) {
    var uri = cl.handleFlagWithParam("url", false);
    if (uri) {
      uri = cl.resolveURI(uri);
      file = uri.QueryInterface(Components.interfaces.nsIFileURL).file;
    }
  }
  
  if (file)
    this.readFile(file);

  this.readCommandLine(cl);
}

Params.prototype = {
  uri: "chrome://webrunner/locale/welcome.html",
  icon: "webrunner",
  showstatus: true,
  showlocation: false,
  enablenavigation: true,

  setParameter: function(name, value) {
    if (typeof this[name] != "string" && typeof this[name] != "boolean")
      return;

    if (typeof this[name] == "boolean")
      value = (value.toLowerCase() == "true" || value.toLowerCase() == "yes");

    this[name] = value;
  },

  readFile: function(file)
  {
    try {
      const PR_RDONLY = 0x01;

      var stream = Components.classes["@mozilla.org/network/file-input-stream;1"]
                             .createInstance(Components.interfaces.nsIFileInputStream);
      stream.init(file, PR_RDONLY, 0, 0);
      stream = stream.QueryInterface(Components.interfaces.nsILineInputStream);

      var line = {};
      var section = null;
      var eof = false;
      while (!eof) {
        eof = !stream.readLine(line);

        if (/^\s*\[(.*)\]\s*$/.test(line.value))
          section = RegExp.$1.toLowerCase();
        else if (section == "parameters" && /^\s*(.*?)=(.*?)\s*$/.test(line.value))
          this.setParameter(RegExp.$1.toLowerCase(), RegExp.$2);
      }
    }
    catch (e) {
      dump(e);
    }
  },

  readCommandLine: function(cl)
  {
    for (var key in this) {
      var value = cl.handleFlagWithParam(key, false);
      if (value != null)
        this.setParameter(key, value);
    }
  }
}
