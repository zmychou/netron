const map = {};

const fs = require('fs');

map.Mapper = class {
    constructor() {

        this._palette = new Map();
        this._layer2nodes = new Map();
        this._keys = [];
        this._mapFile = undefined;
        this._tmp = ['#FA5858', '#DF7401', '#F7FE2E', '#ACFA58', '#04B486', '#FA58F4', '#FE2E9A'];
        this._pigment = ['#F79F81', '#F5DA81', '#D8F781', '#9FF781', '#81F7BE', '#81BEF7', '#A9A9F5',
                         '#BE81F7', '#F781F3', '#FE9A2E', '#80FF00', '#00FF40', '#00BFFF', '#BF00FF',
                         '#B18904', '#04B4AE', '#DF01D7', '#A4A4A4'];

        this._root = document.getElementById('graph');
    }

   
    openMapFile(file, callback) {
        fs.readFile(file, (err, data) => {

            if (err) {
                var e = 'Read ' + file + " error!";
                alert(e);
                callback(e);
                return;
            }


            try {
     
                this._mapFile = JSON.parse(data);
                this._resolveJson();
                callback(null);
            } catch(error) {

                callback(error);
            }
        })
    }

    doMap() {
        this._fillPalette();
        this._setHoverListener();
        this._tint();
    }

    _fillPalette() {
        var keyCount = this._keys.length;
        var colorCount = this._pigment.length;

        var index = 0;
        this._keys.forEach(key => {

            this._palette.set(key, this._pigment[index]);
            index++;
            index %= colorCount;
        });

        if (this._palette.has("UNKNOWN")) {
            this._palette.set('UNKNOWN', 'red');
        }
    }

    _highlightLayer(event, context, dim) {
        var id = null;
        var target = event.target;
        // To find there parent who has a id property
        while (!id) {
            if (target.id != '') {
                id = target.id;
                break;
            }
            target = target.parentElement;

        }

        // Didn't find the valid node
        if ('nodes' === id || 'graph' === id) {
            return;
        }
        context._layer2nodes.forEach((values, key, map) => {
            
            if (id && values.find( ele => { return id === ('node-' + ele); })) {
                values.forEach(node => {
                    var id = context._synthesisId(node);
                    var tag = document.getElementById(id);
                    if (tag){
                        var opacity = dim ? 0.5 : 1;
                        tag.style.opacity = opacity;
                    }
                });
            }
        });
    }

    _resolveJson() {
        Object.entries(this._mapFile).forEach(([key, value]) => {
            this._keys.push(key);
            this._layer2nodes.set(key, value);
        });
    }

    _tint() {
        this._keys.forEach(key => {
            var nodes = this._layer2nodes.get(key);
            var color = this._palette.get(key);
            nodes.forEach(node => {
                var id = this._synthesisId(node);
                this._setNodeColor(id, color);
            });
        });
    }

    _synthesisId(node) {
        var prefix = 'node-';
        return prefix + String(node);
    }

    _setNodeColor(nodeId, color) {
        var node = document.getElementById(nodeId);
        if (node) {
            var paths = node.getElementsByTagName('path');
            for (var j = 0; j < paths.length - 1; j++) {
                paths[j].style.fill = color;
            }
        }
    }

    _setHoverListener() {
        var nodes = document.getElementsByClassName('node');
        var length = nodes.length;
        for (var i = 0; i < length; i++) {
            var node = nodes.item(i)

            var id = node.id;
            var layerDetail = 'Layer: ';
            this._layer2nodes.forEach((values, key, map) => {
                if (id && values.find(ele => { return id === ('node-' + ele); })) {
                        layerDetail += key;
                        layerDetail += '\n';
                        layerDetail += 'Nodes:(' + values.length + ')\n';
                        layerDetail += values.join('\n');
                }
            });
            var title = document.createElementNS('http://www.w3.org/2000/svg', 'title');// document.createElement('title');
            title.textContent = layerDetail;//'Here is tooltip';
            node.appendChild(title);
            node.setAttribute('title', 'This is a test');
            node.addEventListener('mouseover', event => {this._highlightLayer(event, this, true)});
            node.addEventListener('mouseleave', event => {this._highlightLayer(event, this, false)});
        }
    }

    //_findParent
}

if (typeof module !== 'undefined' && typeof module.exports === 'object') {
    module.exports.Mapper = map.Mapper;
}