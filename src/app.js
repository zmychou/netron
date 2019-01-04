/*jshint esversion: 6 */

const electron = require('electron');
const updater = require('electron-updater');
const fs = require('fs');
const os = require('os');
const path = require('path');
const process = require('process');
const url = require('url');

class Application {

    constructor() {
        this._views = new ViewCollection();
        this._configuration = new ConfigurationService();
        this._menu = new MenuService();
        this._openFileQueue = [];

        electron.app.setAppUserModelId('com.lutzroeder.netron');

        if (!electron.app.requestSingleInstanceLock()) {
            electron.app.quit();
        }

        electron.app.on('second-instance', (event, commandLine, workingDirectory) => {
            var currentDirectory = process.cwd();
            process.chdir(workingDirectory);
            var open = this._parseCommandLine(commandLine);
            process.chdir(currentDirectory);
            if (!open) {
                if (this._views.count > 0) {
                    var view = this._views.item(0);
                    if (view) {
                        view.restore();
                    }
                }
            }
        });

        electron.ipcMain.on('open-file-dialog', (e, data) => {
            this._openFileDialog();
        });

        electron.ipcMain.on('select-dir-dialog', (e, data) => {

            var title = 'Select a directory...';
            var key = '';
            switch (data) {
                case 'btn_python_lib_select':
                    title = 'Select a SNPE python lib path...';
                    key = 'SNPE_python_lib';
                    break;
                case 'btn_virtualenv_path':
                    title = 'Select a virtualenv path...';
                    key = 'virtualenv_path';
                    break;
                default: return ;
            }
            electron.dialog.showOpenDialog({title: title,  properties: ['openDirectory']},(dirs) => {
                if (dirs === undefined || dirs.length < 1) {
                    return;
                }
                this._configuration.set(key, dirs[0]);
                this._configuration.save()
                e.sender.send('dir-selected', dirs[0], key);
            });
        });

        electron.ipcMain.on('drop-files', (e, data) => {
            var files = data.files.filter((file) => fs.statSync(file).isFile());
            this._dropFiles(e.sender, files);
        });

        electron.app.on('will-finish-launching', () => {
            electron.app.on('open-file', (e, path) => {
                this._openFile(path);
            });
        });

        electron.app.on('ready', () => {
            this._ready();
        });

        electron.app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                electron.app.quit();
            }
        });

        electron.app.on('will-quit', () => {
            this._configuration.save();
        });

        this._parseCommandLine(process.argv);
        this._checkForUpdates();
    }

    _parseCommandLine(argv) {
        var open = false;
        if (argv.length > 1) {
            argv.slice(1).forEach((arg) => {
                if (!arg.startsWith('-')) {
                    var extension = arg.split('.').pop().toLowerCase();
                    if (extension != '' && extension != 'js' && fs.existsSync(arg) && fs.statSync(arg).isFile()) {
                        this._openFile(arg);
                        open = true;
                    }
                }
            });
        }
        return open;
    }

    _ready() {
        this._configuration.load();
        if (this._openFileQueue) {
            var openFileQueue = this._openFileQueue;
            this._openFileQueue = null;
            while (openFileQueue.length > 0) {
                var file = openFileQueue.shift();
                this._openFile(file);
            }
        }
        if (this._views.count == 0) {
            this._views.openView();
        }
        this._resetMenu();
        this._views.on('active-view-changed', (e) => {
            this._updateMenu();
        });
        this._views.on('active-view-updated', (e) => {
            this._updateMenu();
        });
    }

    _openFileDialog() {
        var showOpenDialogOptions = { 
            properties: [ 'openFile' ], 
            filters: [
                { name: 'All Model Files',  extensions: [ 
                    'onnx', 'pb',
                    'h5', 'hdf5', 'json', 'keras',
                    'mlmodel',
                    'caffemodel',
                    'model', 'dnn', 'cmf', 
                    'meta',
                    'tflite', 'lite',
                    'pt', 'pth', 't7',
                    'pkl', 'joblib',
                    'pbtxt', 'prototxt',
                    'cfg',
                    'xml' ] }
            ]
        };
        electron.dialog.showOpenDialog(showOpenDialogOptions, (selectedFiles) => {
            if (selectedFiles) {
                selectedFiles.forEach((selectedFile) => {
                    this._openFile(selectedFile);
                });
            }
        });
    }

    _openSettingsDialog() {
        var options = {}
        options.parent = electron.BrowserWindow.getAllWindows();
        var settingsWindow = new electron.BrowserWindow({width: 600, height: 400, parent: options.parent[0]});
        settingsWindow.on('closed', () => {
            settingsWindow = null;
        });

        settingsWindow.webContents.on('did-finish-load', () => {
            settingsWindow.webContents.send('load-cfg', this._configuration.get('SNPE_python_lib'), 'SNPE_python_lib');
            settingsWindow.webContents.send('load-cfg', this._configuration.get('virtualenv_path'), 'virtualenv_path');
        });

        var location = url.format({
            pathname: path.join(__dirname, 'settings-dialog-electron.html'),
            protocol: 'file:',
            slashes: true
        });
        settingsWindow.loadURL(location);
    }

    _generateMappingFile(file) {
        console.log('Generating mapping file');
        var pythonLib = this._configuration.get('SNPE_python_lib');
        var virtualenv = this._configuration.get('virtualenv_path');
        if (pythonLib && pythonLib.length > 0) {
            var {Console} = require('console');
            var output = fs.createWriteStream('./stdout.log');
            var errorOutput = fs.createWriteStream('./stderr.log');
            // custom simple logger
            var logger = new Console({ stdout: output, stderr: errorOutput });
            var { exec } = require('child_process');
            var cmd = './src/script/envsetup.sh ' + virtualenv + '/bin/activate ' + pythonLib + ' ' + file;
            exec(cmd, (err, stdout, stderr) => {
                if (!err) {

                    logger.log(stdout);
                    var options = {type: 'info', buttons: [], title: 'Mapping file generated!', 
                        message: 'Mapping file has generated successfully, which in the dir the same as pb file. You can select it to show the mapping.'};
                    electron.dialog.showMessageBox(options);
                }
                else {
                    
                    logger.log(stderr);
                }
            })

        }
    }

    _openFile(file) {
        console.log('debug herer');
        if (this._openFileQueue) {
            this._openFileQueue.push(file);
            return;
        }
        if (file && file.length > 0 && fs.existsSync(file) && fs.statSync(file).isFile()) {
            // find existing view for this file
            var view = this._views.find(file);
            // find empty welcome window
            if (view == null) {
                view = this._views.find(null);
            }

            // .json as suffix indicate that we are opening a mapping file which used to tint the node 
            if (String(file).indexOf('.json') > 0) {
                view = this._views.getDefaultView();
            }

            // create new window
            if (view == null) {
                view = this._views.openView();
            }
            this._loadFile(file, view);
            this._generateMappingFile(file);
        }
    }

    _loadFile(file, view) {
        var recents = this._configuration.get('recents');
        recents = recents.filter(recent => file != recent.path);
        view.open(file);
        recents.unshift({ path: file });
        if (recents.length > 9) {
            recents.splice(9);
        }
        this._configuration.set('recents', recents);
        this._resetMenu();
    }

    _dropFiles(sender, files) {
        var view = this._views.from(sender);
        files.forEach((file) => {
            if (view) {
                this._loadFile(file, view);
                view = null;
            }
            else {
                this._openFile(file);
            }
        });
    }

    _export() {
        var view = this._views.activeView;
        if (view && view.path) {
            var defaultPath = 'Untitled';
            var file = view.path;
            var lastIndex = file.lastIndexOf('.');
            if (lastIndex != -1) {
                defaultPath = file.substring(0, lastIndex);
            }
            var owner = electron.BrowserWindow.getFocusedWindow();
            var showSaveDialogOptions = {
                title: 'Export',
                defaultPath: defaultPath,
                buttonLabel: 'Export',
                filters: [
                    { name: 'PNG', extensions: [ 'png' ] },
                    { name: 'SVG', extensions: [ 'svg' ] }
                ]
            };
            electron.dialog.showSaveDialog(owner, showSaveDialogOptions, (filename) => {
                if (filename) {
                    view.execute('export', { 'file': filename });
                }
            });
        }
    }

    execute(command, data) {
        var view = this._views.activeView;
        if (view) {
            view.execute(command, data || {});
        }
        this._updateMenu();
    }

    _reload() {
        var view = this._views.activeView;
        if (view && view.path) {
            this._loadFile(view.path, view);
        }
    }

    _checkForUpdates() {
        if (this._isDev()) {
            return;
        }
        var autoUpdater = updater.autoUpdater;
        autoUpdater.autoDownload = false;
        autoUpdater.on('update-available', (info) => {
            var owner = electron.BrowserWindow.getFocusedWindow();
            var messageBoxOptions = {
                icon: path.join(__dirname, 'icon.png'),
                title: ' ',
                message: 'A new version of ' + electron.app.getName() + ' is available.',
                detail: 'Click \'Download and Install\' to download the update and automatically install it on exit.',
                buttons: ['Download and Install', 'Remind Me Later'],
                defaultId: 0,
                cancelId: 1
            };
            var result = electron.dialog.showMessageBox(owner, messageBoxOptions);
            if (result == 0) {
                autoUpdater.autoDownload = true;
                autoUpdater.checkForUpdatesAndNotify();
            }
        });
        autoUpdater.checkForUpdates();
    }

    get package() { 
        if (!this._package) {
            var appPath = electron.app.getAppPath();
            var file = appPath + '/package.json'; 
            var data = fs.readFileSync(file);
            this._package = JSON.parse(data);
            this._package.date = new Date(fs.statSync(file).mtime);
        }
        return this._package;
    }

    _about() {
        var owner = electron.BrowserWindow.getFocusedWindow();
        var author = this.package.author;
        var date = this.package.date;
        var details = [];
        details.push('Version ' + electron.app.getVersion());
        if (author && author.name && date) {
            details.push('');
            details.push('Copyright \u00A9 ' + date.getFullYear().toString() + ' ' + author.name);
        }
        var aboutDialogOptions = {
            icon: path.join(__dirname, 'icon.png'),
            title: ' ',
            message: electron.app.getName(),
            detail: details.join('\n')
        };
        electron.dialog.showMessageBox(owner, aboutDialogOptions);
    }

    _isDev() {
        return ('ELECTRON_IS_DEV' in process.env) ?
            (parseInt(process.env.ELECTRON_IS_DEV, 10) === 1) :
            (process.defaultApp || /node_modules[\\/]electron[\\/]/.test(process.execPath));
    }

    _updateMenu() {
        var context = {};
        context.window = electron.BrowserWindow.getFocusedWindow();
        context.webContents = context.window ? context.window.webContents : null; 
        context.view = this._views.activeView;
        this._menu.update(context);
    }

    _resetMenu() {

        var menuRecentsTemplate = [];
        if (this._configuration.has('recents')) {
            var recents = this._configuration.get('recents');
            recents = recents.filter(recent => fs.existsSync(recent.path) && fs.statSync(recent.path).isFile());
            if (recents.length > 9) {
                recents.splice(9);
            }
            this._configuration.set('recents', recents);
            recents.forEach((recent, index) => {
                var file = recent.path;
                menuRecentsTemplate.push({
                    label: Application.minimizePath(recent.path),
                    accelerator: ((process.platform === 'darwin') ? 'Cmd+' : 'Ctrl+') + (index + 1).toString(),
                    click: () => { this._openFile(file); }
                });
            });
        }

        var menuTemplate = [];
        
        if (process.platform === 'darwin') {
            menuTemplate.unshift({
                label: electron.app.getName(),
                submenu: [
                    { role: "about" },
                    { type: 'separator' },
                    { role: 'hide' },
                    { role: 'hideothers' },
                    { role: 'unhide' },
                    { type: 'separator' },
                    { role: "quit" }
                ]
            });
        }
        
        menuTemplate.push({
            label: '&File',
            submenu: [
                {
                    label: '&Open...',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => { this._openFileDialog(); }
                },
                {
                    label: 'Open &Recent',
                    submenu: menuRecentsTemplate
                },
                { type: 'separator' },
                { 
                    id: 'file.export',
                    label: '&Export...',
                    accelerator: 'CmdOrCtrl+Shift+E',
                    click: () => this._export(),
                },
                { type: 'separator' },
                {
                    label: 'Settings...',
                    click: () => {this._openSettingsDialog();},
                },
                { role: 'close' },
            ]
        });
        
        if (process.platform !== 'darwin') {
            menuTemplate.slice(-1)[0].submenu.push(
                { type: 'separator' },
                { role: 'quit' }
            );
        }

        if (process.platform == 'darwin') {
            electron.systemPreferences.setUserDefault('NSDisabledDictationMenuItem', 'boolean', true);
            electron.systemPreferences.setUserDefault('NSDisabledCharacterPaletteMenuItem', 'boolean', true);
        }

        menuTemplate.push({
            label: '&Edit',
            submenu: [
                {
                    id: 'edit.cut',
                    label: 'Cu&t',
                    accelerator: 'CmdOrCtrl+X',
                    click: () => this.execute('cut', null),
                },
                {
                    id: 'edit.copy',
                    label: '&Copy',
                    accelerator: 'CmdOrCtrl+C',
                    click: () => this.execute('copy', null),
                },
                {
                    id: 'edit.paste',
                    label: '&Paste',
                    accelerator: 'CmdOrCtrl+V',
                    click: () => this.execute('paste', null),
                },
                {
                    id: 'edit.select-all',
                    label: 'Select &All',
                    accelerator: 'CmdOrCtrl+A',
                    click: () => this.execute('selectall', null),
                },
                { type: 'separator' },
                {
                    id: 'edit.find',
                    label: '&Find...',
                    accelerator: 'CmdOrCtrl+F',
                    click: () => this.execute('find', null),
                }
            ]
        });
    
        var viewTemplate = {
            label: '&View',
            submenu: [
                {
                    id: 'view.show-attributes',
                    accelerator: 'CmdOrCtrl+D',
                    click: () => this.execute('toggle-attributes', null),
                },
                {
                    id: 'view.show-initializers',
                    accelerator: 'CmdOrCtrl+I',
                    click: () => this.execute('toggle-initializers', null),
                },
                {
                    id: 'view.show-names',
                    accelerator: 'CmdOrCtrl+U',
                    click: () => this.execute('toggle-names', null),
                },
                { type: 'separator' },
                {
                    id: 'view.reload',
                    label: '&Reload',
                    accelerator: (process.platform === 'darwin') ? 'Cmd+R' : 'F5',
                    click: () => this._reload(),
                },
                { type: 'separator' },
                {
                    id: 'view.reset-zoom',
                    label: 'Actual &Size',
                    accelerator: 'CmdOrCtrl+Backspace',
                    click: () => this.execute('reset-zoom', null),
                },
                {
                    id: 'view.zoom-in',
                    label: 'Zoom &In',
                    accelerator: 'CmdOrCtrl+Up',
                    click: () => this.execute('zoom-in', null),
                },
                {
                    id: 'view.zoom-out',
                    label: 'Zoom &Out',
                    accelerator: 'CmdOrCtrl+Down',
                    click: () => this.execute('zoom-out', null),
                },
                { type: 'separator' },
                {
                    id: 'view.show-properties',
                    label: '&Properties...',
                    accelerator: 'CmdOrCtrl+Enter',
                    click: () => this.execute('show-properties', null),
                }        
            ]
        };
        if (this._isDev()) {
            viewTemplate.submenu.push({ type: 'separator' });
            viewTemplate.submenu.push({ role: 'toggledevtools' });
        }
        menuTemplate.push(viewTemplate);

        if (process.platform === 'darwin') {
            menuTemplate.push({
                role: 'window',
                submenu: [
                    { role: 'minimize' },
                    { role: 'zoom' },
                    { type: 'separator' },
                    { role: 'front'}
                ]
            });
        }    

        var helpSubmenu = [
            {
                label: '&Search Feature Requests',
                click: () => { electron.shell.openExternal('https://www.github.com/' + this.package.repository + '/issues'); }
            },
            {
                label: 'Report &Issues',
                click: () => { electron.shell.openExternal('https://www.github.com/' + this.package.repository + '/issues/new'); }
            }
        ];

        if (process.platform != 'darwin') {
            helpSubmenu.push({ type: 'separator' });
            helpSubmenu.push({
                role: 'about',
                click: () => this._about()
            });
        }

        menuTemplate.push({
            role: 'help',
            submenu: helpSubmenu
        });

        var commandTable = {};
        commandTable['file.export'] = {
            enabled: (context) => { return context.view && context.view.path ? true : false; }
        };
        commandTable['edit.cut'] = {
            enabled: (context) => { return context.view && context.view.path ? true : false; }
        };
        commandTable['edit.copy'] = {
            enabled: (context) => { return context.view && context.view.path ? true : false; }
        };
        commandTable['edit.paste'] = {
            enabled: (context) => { return context.view && context.view.path ? true : false; }
        };
        commandTable['edit.select-all'] = {
            enabled: (context) => { return context.view && context.view.path ? true : false; }
        };
        commandTable['edit.find'] = {
            enabled: (context) => { return context.view && context.view.path ? true : false; }
        };
        commandTable['view.show-attributes'] = {
            enabled: (context) => { return context.view && context.view.path ? true : false; },
            label: (context) => { return !context.view || !context.view.get('show-attributes') ? 'Show &Attributes' : 'Hide &Attributes'; }
        };
        commandTable['view.show-initializers'] = {
            enabled: (context) => { return context.view && context.view.path ? true : false; },
            label: (context) => { return !context.view || !context.view.get('show-initializers') ? 'Show &Initializers' : 'Hide &Initializers'; }
        };
        commandTable['view.show-names'] = {
            enabled: (context) => { return context.view && context.view.path ? true : false; },
            label: (context) => { return !context.view || !context.view.get('show-names') ? 'Show &Names' : 'Hide &Names'; }
        };
        commandTable['view.reload'] = {
            enabled: (context) => { return context.view && context.view.path ? true : false; }
        };
        commandTable['view.reset-zoom'] = {
            enabled: (context) => { return context.view && context.view.path ? true : false; }
        };
        commandTable['view.zoom-in'] = {
            enabled: (context) => { return context.view && context.view.path ? true : false; }
        };
        commandTable['view.zoom-out'] = {
            enabled: (context) => { return context.view && context.view.path ? true : false; }
        };
        commandTable['view.show-properties'] = {
            enabled: (context) => { return context.view && context.view.path ? true : false; }
        };

        this._menu.build(menuTemplate, commandTable);
        this._updateMenu();
    }

    static minimizePath(file) {
        if (process.platform != 'win32') {
            var home = os.homedir();
            if (file.startsWith(home))
            {
                return '~' + file.substring(home.length);
            }
        }
        return file;
    }

}

class View {

    constructor(owner) {
        this._owner = owner;
        this._ready = false;
        this._path = null;
        this._properties = {};

        const size = electron.screen.getPrimaryDisplay().workAreaSize;
        var options = {};
        options.title = electron.app.getName(); 
        options.backgroundColor = electron.systemPreferences.isDarkMode() ? '#1d1d1d' : '#e6e6e6';
        options.icon = electron.nativeImage.createFromPath(path.join(__dirname, 'icon.png'));
        options.minWidth = 600;
        options.minHeight = 400;
        options.width = size.width;
        options.height = size.height;
        if (options.width > 1024) {
            options.width = 1024;
        }
        if (options.height > 768) {
            options.height = 768;
        }
        if (this._owner.count > 0 && View._position && View._position.length == 2) {
            options.x = View._position[0] + 30;
            options.y = View._position[1] + 30;
            if (options.x + options.width > size.width) {
                options.x = 0;
            }
            if (options.y + options.height > size.height) {
                options.y = 0;
            }
        }
        this._window = new electron.BrowserWindow(options);
        View._position = this._window.getPosition();
        this._updateCallback = (e, data) => { 
            if (e.sender == this._window.webContents) {
                this.update(data.name, data.value); 
                this._raise('updated');
            }
        };
        electron.ipcMain.on('update', this._updateCallback);
        this._window.on('closed', () => {
            electron.ipcMain.removeListener('update', this._updateCallback);
            this._owner.closeView(this);
        });
        this._window.on('focus', (e) => {
            this._raise('activated');
        });
        this._window.on('blur', (e) => {
            this._raise('deactivated');
        });
        this._window.webContents.on('dom-ready', () => {
            this._ready = true;
        });
        this._window.webContents.on('new-window', (event, url) => {
            if (url.startsWith('http://') || url.startsWith('https://')) {
                event.preventDefault();
                electron.shell.openExternal(url);
            }
        });
        var location = url.format({
            pathname: path.join(__dirname, 'view-electron.html'),
            protocol: 'file:',
            slashes: true
        });
        this._window.loadURL(location);
    }

    get window() {
        return this._window;
    }

    get path() {
        return this._path;
    }

    open(file) {
        this._openPath = file;
        if (this._ready) {
            this._window.webContents.send("open", { file: file });
        }
        else {
            this._window.webContents.on('dom-ready', () => {
                this._window.webContents.send("open", { file: file });
            });
            var location = url.format({
                pathname: path.join(__dirname, 'view-electron.html'),
                protocol: 'file:',
                slashes: true
            });
            this._window.loadURL(location);
        }
    }

    restore() {
        if (this._window) { 
            if (this._window.isMinimized()) {
                this._window.restore();
            }
            this._window.show();
        }
    }

    match(path) {
        if (this._openPath) {
            if (path == null) {
                return false;
            }
            if (path == this._openPath) {
                return true;
            }
        }
        return (this._path == path);
    }

    execute(command, data) {
        if (this._window && this._window.webContents) {
            this._window.webContents.send(command, data);
        }
    }

    update(name, value) {
        switch (name) {
            case 'path':
                if (value) {
                    this._path = value;
                    var title = Application.minimizePath(this._path);
                    if (process.platform !== 'darwin') {
                        title = title + ' - ' + electron.app.getName();
                    }
                    this._window.setTitle(title);
                    this._window.focus();
                }
                this._openPath = null;
                break;
            default:
                this._properties[name] = value;
                break;
        }
    }

    get(name) {
        return this._properties[name];
    }

    on(event, callback) {
        this._events = this._events || {};
        this._events[event] = this._events[event] || [];
        this._events[event].push(callback);
    }

    _raise(event, data) {
        if (this._events && this._events[event]) {
            this._events[event].forEach((callback) => {
                callback(this, data);
            });
        }
    }
}

class ViewCollection {
    constructor() {
        this._views = [];
    }

    get count() {
        return this._views.length;
    }

    item(index) {
        return this._views[index];
    }

    openView() {
        var view = new View(this);
        view.on('activated', (sender) => {
            this._activeView = sender;
            this._raise('active-view-changed', { activeView: this._activeView });
        });
        view.on('updated', (sender) => {
            this._raise('active-view-updated', { activeView: this._activeView });            
        });
        view.on('deactivated', (sender) => {
            this._activeView = null;
            this._raise('active-view-changed', { activeView: this._activeView });
        });
        this._views.push(view);
        this._updateActiveView();
        return view;
    }

 
    getDefaultView() {
        if (this._views != undefined && this._views.length > 0) {
            return this._views[0];
        }
        return null;
    }

    closeView(view) {
        for (var i = this._views.length - 1; i >= 0; i--) {
            if (this._views[i] == view) {
                this._views.splice(i, 1);
            }
        }
        this._updateActiveView();
    }

    find(path) {
        return this._views.find(view => view.match(path));
    }

    from(contents) {
        return this._views.find(view => view && view.window && view.window.webContents && view.window.webContents == contents);
    }

    get activeView() {
        return this._activeView;
    }

    on(event, callback) {
        this._events = this._events || {};
        this._events[event] = this._events[event] || [];
        this._events[event].push(callback);
    }

    _raise(event, data) {
        if (this._events && this._events[event]) {
            this._events[event].forEach((callback) => {
                callback(this, data);
            });
        }
    }

    _updateActiveView() {
        var window = electron.BrowserWindow.getFocusedWindow();
        var view = this._views.find(view => view.window == window) || null;
        if (view != this._activeView) {
            this._activeView = view;
            this._raise('active-view-changed', { activeView: this._activeView });        
        }
    }
}

class ConfigurationService {

    load() {
        var dir = electron.app.getPath('userData');
        if (dir && dir.length > 0) {
            var file = path.join(dir, 'configuration.json'); 
            if (fs.existsSync(file)) {
                var data = fs.readFileSync(file);
                if (data) {
                    this._data = JSON.parse(data);
                }
            }
        }
        if (!this._data) {
            this._data = {
                'recents': []
            };
        }
    }

    save() {
        if (this._data) {
            var data = JSON.stringify(this._data);
            if (data) {
                var dir = electron.app.getPath('userData');
                if (dir && dir.length > 0) {
                    var file = path.join(dir, 'configuration.json'); 
                    fs.writeFileSync(file, data);
                }
            }
        }
    }

    has(name) {
        return this._data && this._data.hasOwnProperty(name);
    }

    set(name, value) {
        this._data[name] = value;
    }

    get(name) {
        return this._data[name];
    }

}

class MenuService {

    build(menuTemplate, commandTable) {
        this._menuTemplate = menuTemplate;
        this._commandTable = commandTable;
        this._itemTable = {};
        menuTemplate.forEach((menuTemplateMenu) => {
            menuTemplateMenu.submenu.forEach((menuTemplateItem) => {
                if (menuTemplateItem.id) {
                    if (!menuTemplateItem.label) {
                        menuTemplateItem.label = '';
                    }
                    this._itemTable[menuTemplateItem.id] = menuTemplateItem;
                }
            });
        });
        this._rebuild();
    }

    update(context) {
        if (!this._menu && !this._commandTable) {
            return;
        }
        var rebuild = false;
        Object.keys(this._commandTable).forEach((id) => {
            var menuItem = this._menu.getMenuItemById(id);
            var command = this._commandTable[id];
            if (command && command.label) {
                var label = command.label(context);
                if (label != menuItem.label) {
                    var menuTemplateItem = this._itemTable[id];
                    if (menuTemplateItem) {
                        menuTemplateItem.label = label;
                        rebuild = true;
                    }
                }
            }
        });
        if (rebuild) {
            this._rebuild();
        }
        Object.keys(this._commandTable).forEach((id) => {
            var menuItem = this._menu.getMenuItemById(id);
            var command = this._commandTable[id];
            if (command) {
                if (command.enabled) {
                    menuItem.enabled = command.enabled(context);
                }
                if (command.label) {
                    if (menuItem.label != command.label(context)) {

                    }
                }
            }
        });
    }

    _rebuild() {
        this._menu = electron.Menu.buildFromTemplate(this._menuTemplate);
        electron.Menu.setApplicationMenu(this._menu);
    }
}

var application = new Application();
