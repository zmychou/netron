const electron = require('electron');

var pythonLibBtn = document.getElementById('btn_python_lib_select');
var virtualenvBtn = document.getElementById('btn_virtualenv_path');

electron.ipcRenderer.on('dir-selected', (e, dir, id) => {
    _inflateInputElement(id, dir);
}) ;

electron.ipcRenderer.on('load-cfg', (e, dir, id) => {
    _inflateInputElement(id, dir);
});

function _inflateInputElement(id, value) {
    var element = document.getElementById(id);
    if (element) {
        element.value = value;
    }
}

pythonLibBtn.addEventListener('click', (event) => {
    electron.ipcRenderer.send('select-dir-dialog', 'btn_python_lib_select');

});

virtualenvBtn.addEventListener('click', (event) => {
    electron.ipcRenderer.send('select-dir-dialog', 'btn_virtualenv_path');

})