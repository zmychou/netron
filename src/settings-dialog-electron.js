const electron = require('electron');

var pythonLibBtn = document.getElementById('btn_python_lib_select');

electron.ipcRenderer.on('dir-selected', (e, dir) => {
    var inputBox = document.getElementById('python_lib');
    console.log('recieve ' + dir);
    inputBox.value = dir;
}) ;

electron.ipcRenderer.on('load-cfg', (e, data) => {
    var inputBox = document.getElementById('python_lib');
    inputBox.value = data;

});

pythonLibBtn.addEventListener('click', (event) => {
    electron.ipcRenderer.send('select-dir-dialog');

});