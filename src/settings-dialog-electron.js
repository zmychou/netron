const electron = require('electron');

var pythonLibBtn = document.getElementById('btn_python_lib_select');
var virtualenvBtn = document.getElementById('btn_virtualenv_path');
var virtualenvCb = document.getElementById('cb_use_virtualenv');
var generateMapFileCb = document.getElementById('cb_generate_map_file') ;

electron.ipcRenderer.on('load-cfg', (e, settings) => {
    console.log(settings.useVirtualenv);
    var pythonlib = settings.lib;
    var virtualenvPath = settings.virtualenv;
    var useVirtualenv = settings.useVirtualenv;
    var generateMapFile = settings.generateMapFile;
    _inflateInputElement('SNPE_python_lib', pythonlib);
    _inflateInputElement('virtualenv_path', virtualenvPath);

    _setCheckbox('cb_use_virtualenv', useVirtualenv);
    _setCheckbox('cb_generate_map_file', generateMapFile);

});

function _inflateInputElement(id, value) {
    var element = document.getElementById(id);
    if (element) {
        element.value = value;
    }
}

function _setCheckbox(id, checked) {
    var element = document.getElementById(id);
    if (element) {
        element.checked = checked;
    }
}


pythonLibBtn.addEventListener('click', (event) => {
    electron.ipcRenderer.send('select-dir-dialog', 'btn_python_lib_select');

});

virtualenvBtn.addEventListener('click', (event) => {
    electron.ipcRenderer.send('select-dir-dialog', 'btn_virtualenv_path');

});

virtualenvCb.addEventListener('change', (event) => {
    electron.ipcRenderer.send('checkbox-changed', 'cb_use_virtualenv', virtualenvCb.checked);

});

generateMapFileCb.addEventListener('change', (event) => {
    electron.ipcRenderer.send('checkbox-changed', 'cb_generate_map_file', generateMapFileCb.checked);
});
