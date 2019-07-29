//import { realpathSync } from "fs";

var dlc = dlc || {};
dlc.dnn_serial3 = dlc.dnn_serial3 || {}

dlc.ModelFactory = class {
	match(context, host) {
		this._entries = this._extract_files_from_dlc(context);
		this._model = null;
		this._param = null;
		this._meta = null;
		var matches = 0;
		var majorVersion = 0;
		var entries = this._entries;
		entries.forEach((entry) => {
			switch(entry.name) {
				case 'dlc.metadata':
					this._meta = entry.data;
					if (this._match_metadata(entry)) {
						matches++;
					}
					break;
				case 'model':
					this._model = entry.data;
					if (this._match_model(entry)) {
						majorVersion = this.__readInt16(entry.data, 2);
						matches++;
					}
					break;
				case 'model.params':
					this._param = entry.data;
					if (this._match_params(entry)) {
						matches++;
					}
					break;
				default: break;
			}
		});

		if (majorVersion == 3 && matches == 3) {
			return true;
		} else if (majorVersion == 2 && matches == 2) {
			return true;
		}
		return false;
	}
	

    open(context, host, callback) { 
		//TO-DO: require other module before go on
		host.require('./NetworkCommon_generated', (err, module) => {
			if (err) {
				callback(err, null);
				return;
			}
			host.require('./Network_generated', (err, module) => {
				if (err) {
					callback(err, null);
					return;
				}
				var network = new dlc.dnn_serial3.Network(this._model);
				try {
					var model = new dlc.Model(null, network, null);
					callback(null, model);
				} catch (error) {
					host.exception(error, false);
					callback(new dlc.Error(error.message), null);
				}
			});
		});

	}

	_extract_files_from_dlc(context) {

		var buffer = context.buffer;
		var identifier = context.identifier;
		var archive = new dlc.Archive(buffer);
		var entries = archive.entries;
		return entries;
	}

	_match_metadata(entry) {
		// TO-DO: verify metadata file
		return true;
	}

	_match_model(entry) {
		var buffer = entry.data;
		var magic = this.__readInt16(buffer, 0);
		var majorVersion = this.__readInt16(buffer, 2);
		var minorVersion = this.__readInt16(buffer, 4);
		var patchVersion = this.__readInt16(buffer, 6);
		if (magic != 0x0AD5) {
			return false;
		}
		if (majorVersion != 3 ) { // TO-DO: add V2 support || majorVersion != 2) {
			return false;	
		}
		//TO-DO: verify minor version and patch version
		return true;
	}

	_match_params() {
		// TO-DO: verify model params
		return true;
	}
	
	__readInt16(buf, offset) {
		var size = buf.length;
		if (size < offset) {
			return 0;
		}
		if (size < offset + 2) {
			return buf[offset];
		}
		return buf[offset] | buf[offset + 1] << 8;
	}
}

dlc.dnn_serial3.Network = class {
	constructor(buf) {

		this._bb = new flatbuffers.ByteBuffer(buf.slice(8, buf.length));
		this._network = dnn_serial3.Network.getRootAsNetwork(this._bb);
		this._name = this._network.name();
		this._layers = this._getLayers();
		this._externalInput = this._getExternalInput();
		this._externalOutput = this._getExternalOutput();
		this._args = this._getArgs();
	}

	get name() {
		return this._name;
	}

	get layers() {
		return this._layers;
	}

	get args() {
		return this._args;
	}

	get externalInput() {
		return this._externalInput;
	}

	get externalOutput() {
		return this._externalOutput;
	}

	_getLayers() {
		var layersCount = this._network.layersLength();
		var layers = [];
		for (var i = 0; i < layersCount; i++) {
			layers.push(new dlc.dnn_serial3.Layer(this._network.layers(i)));
		}
		return layers;
	}

	_getExternalOutput() {
		var outputsCount = this._network.externalOutputsLength();
		var outputs = [];
		for (var i = 0; i < outputsCount; i++) {
			outputs.push(this._network.externalOutputs(i));
		}
		return outputs;
	}

	_getExternalInput() {
		var inputsCount = this._network.externalInputsLength();
		var inputs = [];
		for (var i = 0; i < inputsCount; i++) {
			inputs.push(this._network.externalInputs(i));
		}
		return inputs;
	}

	_getArgs() {
		var argsCount = this._network.argsLength();
		var args = [];
		for (var i = 0; i < argsCount; i++) {
			args.push(new dlc.dnn_serial3.Argument(this._network.args(i)));
		}
		return args;
	}
}

dlc.dnn_serial3.Layer = class {
	constructor(layer) {
		this._layer = layer;
		this._id = layer.id();
		this._name = layer.name();
		this._type = layer.type();
		this._inputs = this._getInputs();
		this._outputs = this._getOutputs();
		this._args = this._getArgs();
	}

	get id() {
		return this._id;
	}

	get name() {
		return this._name;
	}

	get type() {
		return this._type;
	}

	get inputs() {
		return this._inputs;
	}

	get outputs() {
		return this._outputs;
	}

	get args() {
		return this._args;
	}

	_getInputs() {
		var count = this._layer.inputsLength();
		var inputs = [];
		for (var i = 0; i < count; i++) {
			inputs.push(this._layer.inputs(i));
		}
		return inputs;
	}

	_getOutputs() {
		var count = this._layer.outputsLength();
		var outputs = [];
		for (var i = 0; i < count; i++) {
			outputs.push(this._layer.outputs(i));
		}
		return outputs;
	}

	_getArgs() {
		var argsCount = this._layer.argsLength();
		var args = [];
		for (var i = 0; i < argsCount; i++) {
			args.push(new dlc.dnn_serial3.Argument(this._layer.args(i)));
		}
		return args;
	}

}

dlc.dnn_serial3.Argument = class {
	constructor(arg) {
		this._arg = arg;
		this._name = arg.name();
		this._type = arg.type();
		this._boolean = arg.Boolean();
		this._int = arg.Int();
		this._uint = arg.UInt();
		this._float = arg.Float();
		this._string = arg.String();
		this._ubytes = arg.UBytesArray();
		this._ints = arg.IntsArray();
		this._uints = arg.UIntsArray();
		this._floats = arg.FloatsArray();
		this._strings = this._getStrings();
		this._args = this._getArgs();
	}

	get name() {
		return this._name;
	}

	get type() {
		return this._type;
	}

	get boolean() {
		return this._boolean;
	}

	get int() {
		return this._int;
	}

	get uint() {
		return this._uint;
	}

	get float() {
		return this._float;
	}

	get string() {
		return this._string;
	}

	get ubytes() {
		return this._ubytes;
	}

	get ints() {
		return this._ints;
	}

	get uints() {
		return this._uints;
	}

	get floats() {
		return this._floats;
	}

	get strings() {
		return this._strings;
	}

	get args() {
		return this._args;
	}

	_getStrings() {
		var count = this._arg.StringsLength();
		var strings =[];
		for (var i = 0; i < count; i++) {
			strings.push(new dlc.dnn_serial3.Argument(this._arg.Strings(i)));
		}
		return strings;
	}

	_getArgs() {
		var argsCount = this._arg.ArgsLength();
		var args = [];
		for (var i = 0; i < argsCount; i++) {
			args.push(new dlc.dnn_serial3.Argument(this._arg.Args(i)));
		}
		return args;
	}
}

dlc.dnn_serial3.NetworkParams = class {
	constructor(buf) {
		this._buf = buf;
		this._bb = new flatbuffers.ByteBuffer(buf);
		this._networkParams = dnn_serial3.NetworkParams.getRootAsNetworkParams(this._bb);
		this._layerParams = this._getLayerParams();

	}

	get layerParams() {
		return this._layerParams;
	}

	_getLayerParams() {
		var count = this._networkParams.layerParamsLength();
		var layerParams = [];
		for (var i = 0; i < count; i++) {
			layerParams.push(new dlc.dnn_serial3.LayerParam(this._networkParams.layerParams(i)))

		}
		return layerParams;
	}
}

dlc.dnn_serial3.LayerParam = class {
	constructor(param) {
		this._param = param;
		this._name = param.name();
		this._tensors = this._getTensors();

	}

	get tensors() {
		this._tensors;
	}

	get name() {
		return this._name;
	}

	get param() {
		return this._param;
	}

	_getTensors() {
		var count = this._param.tensorsLength();
		var list = [];
		for (var i = 0; i < count; i++) {
			list.push(new dlc.dnn_serial3.Tensor(this._param.tensors(i)))

		}
		return list;
	}
}

dlc.dnn_serial3.Tensor = class {
	constructor(tensor) {
		this._tensor = tensor;
		this._name = tensor.name();
		this._dims = tensor.dimsArray();
		this._data = new dlc.dnn_serial3.TensorData(tensor.data());
		this._args = this._getArgs();
	}

	_getArgs() {
		var argsCount = this._tensor.argsLength();
		var args = [];
		for (var i = 0; i < argsCount; i++) {
			args.push(new dlc.dnn_serial3.Argument(this._tensor.Args(i)));
		}
		return args;
	}

	get name() {
		return this._name;
	}

	get dims() {
		return this._dims;
	}

	get data() {
		return this._data;
	}

	get args() {
		return this._args;
	}
}

dlc.dnn_serial3.TensorData = class {
	constructor(data) {
		this._tensorData = data;
		this._type = data.type();
		this._ubytes = data.UBytesArray();
		this._floats = data.FloatsArray();
	}

	get tensorData() {
		return this._tensorData;
	}

	get type() {
		return this._type;
	}

	get ubytes() {
		return this._ubytes;
	}

	get floats() {
		return this._floats;
	}
}


dlc.Model = class {
	constructor(metadata, network, networkParam) {
		this._graph = new dlc.Graph(network, networkParam);
		
	}

	get format() {
		var format = 'DLC';

		return format;
	}

	get graphs() {
		return [this._graph];
	}

	get description() {}

}

dlc.Graph = class {
	constructor(network, networkParam){
		this._layers = network.layers;
		this._nodes = [];
		this._layers.forEach((layer) => {
			this._nodes.push(new dlc.Node(layer));
		});
		this._inputs = [];
		this._outputs = [];
		this._operator = [];
		this._nodes.forEach(node => {
			this._operator.push(node.operator);
		});
	}

	get groups() {
		return false;
	}

	get inputs() {
		return this._inputs;
	}

	get outputs() {
		return this._outputs;
	}

	get nodes() {
		return this._nodes;
	}

	get operator() {
		return this._operator;
	}
}

dlc.Node = class {
	constructor(layer) {
		this._name = layer.name;
		this._inputs = [];
		this._outputs = [];
		this._operator = layer.type;
		layer.inputs.forEach(input => {
			this._inputs.push(new dlc.Argument(input, layer.inputs.map(i => {
				return new dlc.Connection(i, null, null);
			})));
		});
		layer.outputs.forEach(output => {
			this._outputs.push(new dlc.Argument(output, layer.outputs.map(i => {
				return new dlc.Connection(i, null, null);
			})));
		});
	}

	get name() {
		return this._name;
	}

	get inputs() {
		return this._inputs;
	}
	
	get outputs() {
		return this._outputs;
	}

	get documentation() {
		return 'TO-DO';
	}

	get atrributes() {
		return
	}

	set atrributes(attr) {}

	get operator() {
		return this._operator;
	}

	get group() {
		return null;
	}

	get category() {}


}

dlc.Argument = class {
	constructor(name, connections) {
		this._name = name;
		this._connections = connections;
	}

	get name() {
		return this._name;
	}

	get visible() {
		return true;
	}

	get connections() {
		return this._connections;
	}

}

dlc.Connection = class {
	constructor(id, initializer, type) {
		this._id = id;
		this._initializer = initializer;
		this._type = type;
	}

	get id() {
		return this._id;
	}

	get initializer() {
		return this._initializer;
	}

	get type() {
		this._type;
	}

}

dlc.Tensor = class {

}

dlc.Archive = class {
	constructor(buffer) {

        this._entries = [];
        if (buffer.length < 4 || buffer[0] != 0x50 || buffer[1] != 0x4B) {
            throw new zip.Error('Invalid ZIP archive.');
        }
        var reader = null;
        for (var i = buffer.length - 4; i >= 0; i--) {
            if (buffer[i] === 0x50 && buffer[i + 1] === 0x4B && buffer[i + 2] === 0x06 && buffer[i + 3] === 0x06) {
                reader = new zip.Reader(buffer, i + 4, buffer.length);
                break;
            }
        }
        if (!reader) {
            throw new zip.Error('End of central directory not found.');
        }
        reader.skip(44);
        reader.position = reader.uint64(); // zip64 central directory offset
        while (reader.match([ 0x50, 0x4B, 0x01, 0x02 ])) {
            this._entries.push(new zip.Entry(reader));
        }
    }

    get entries() {
        return this._entries;
    }
	
};

dlc.Error = class extends Error {
    constructor(message) {
        super(message);
        this.name = 'Error loading DLC model.';
    }
};

if (typeof module !== 'undefined' && typeof module.exports === 'object') {
    module.exports.ModelFactory = dlc.ModelFactory;
}