/******************************************************************************
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Prism Extension.
 *
 * The Initial Developer of the Original Code is Cesar Oliveira 
 *	<a.sacred.line@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *****************************************************************************/

var Prism = {
	get runtime() {
		let xre = Cc["@mozilla.org/file/directory_service;1"]
				.getService(Ci.nsIProperties)
				.get("CurProcD", Ci.nsIFile);
		switch (OS.name) {
			case 'WINDOWS' :
				path.append('firefox.exe');
				break;
			case 'UNIX' :
			case 'DARWIN' :
				path.append('firefox');
				break;
		}

		return path;
	},

	get application() {
		const id = "prism-ext@developer.mozilla.org";
		var prism = Cc["@mozilla.org/extensions/manager;1"]
			     .getService(Ci.nsIExtensionManager)
			     .getInstallLocation(id)
			     .getItemLocation(id);

		prism.append('prism');
		prism.append('application.ini');

		if (!prism.exists())
			prism = null;

		return prism;
	},

	start_webapp : function(target) {
		let process = Cc["@mozilla.org/process/util;1"]
				.createInstance(Ci.nsIProcess);
		let runtime = Cc["@mozilla.org/file/directory_service;1"]
				.getService(Ci.nsIProperties)
				.get("XREExeF", Ci.nsIFile);

		process.init(runtime);

		let args = [ '-app', this.application.path, '-webapp', target ];
		process.run(false, args, args.length);
	},

	start_cl : function(url) {
		let process = Cc["@mozilla.org/process/util;1"]
				.createInstance(Ci.nsIProcess);
		let runtime = Cc["@mozilla.org/file/directory_service;1"]
				.getService(Ci.nsIProperties)
				.get("XREExeF", Ci.nsIFile);

		process.init(runtime);

		let args = [ '-app', this.application.path, '-uri', url, '-install' ];
		process.run(false, args, args.length);

	}
};

