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
				var metadata = new dlc.dnn_serial3.Metadata(this._meta);
				try {
					var model = new dlc.Model(metadata, network, null, context.identifier);
					host.require('./NetworkParams_generated', (err, module) => {
						var params = new dlc.dnn_serial3.NetworkParams(this._param);
						params.layerParams.forEach(layerParam => {
							layerParam.tensors.forEach(tensor => {
								
								 model.graph.addNodeInput(layerParam.name, tensor);
							});
						});
						callback(null, model);
					});
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

dlc.dnn_serial3.Metadata = class {
	constructor(meta) {
		this._string = this._arrayToUTF8String(meta)
		this._meta = [];
		var ss = this._string.split('\n');
		var kvs = [];
		ss.forEach(item => {
			var v = item.split(' ');
			v.forEach(i => kvs.push(i));
		});

		kvs.forEach(item => {
			var kv = item.split('=');
			this._meta.push({name: kv[0], value: kv[1]});
			if (kv[0] == 'converter-version') {
				this._version = kv[1];

			}
		});
	}

	get meta() {
		return this._meta;

	}

	get producer() {
		return 'SNPE@' + this._version;
	}



	_arrayToUTF8String(data)
	{
	  const extraByteMap = [ 1, 1, 1, 1, 2, 2, 3, 0 ];
	  var count = data.length;
	  var str = "";
	  
	  for (var index = 0;index < count;)
	  {
		var ch = data[index++];
		if (ch & 0x80)
		{
		  var extra = extraByteMap[(ch >> 3) & 0x07];
		  if (!(ch & 0x40) || !extra || ((index + extra) > count))
			return null;
		  
		  ch = ch & (0x3F >> extra);
		  for (;extra > 0;extra -= 1)
		  {
			var chx = data[index++];
			if ((chx & 0xC0) != 0x80)
			  return null;
			
			ch = (ch << 6) | (chx & 0x3F);
		  }
		}
		
		str += String.fromCharCode(ch);
	  }
	  
	  return str;
	}
}

dlc.dnn_serial3.Network = class {
	constructor(buf) {
		this._version = buf[3] << 8 | buf[2];
		this._bb = new flatbuffers.ByteBuffer(buf.slice(8, buf.length));
		this._network = dnn_serial3.Network.getRootAsNetwork(this._bb);
		this._name = this._network.name();
		this._layers = this._getLayers();
		this._externalInput = this._getExternalInput();
		this._externalOutput = this._getExternalOutput();
		this._args = this._getArgs();
	}

	get version() {
		return this._version;
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
		this._bb = new flatbuffers.ByteBuffer(buf.slice(8, buf.length));
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
		return this._tensors;
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
		this._data = new dlc.dnn_serial3.TensorData(tensor.data(), this._dims);
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
	constructor(data, dims) {
		this._dims = dims;
		this._tensorData = data;
		this._type = data.type();
		this._ubytes = data.UBytesArray();
		this._floats = data.FloatsArray();
		if (this._ubytes) {
			this._typeToString = 'UByte';
			this._ubytes = this._slice(this._ubytes, dims, 0);
		}

		if (this._floats) {
			this._typeToString = 'float';
			this._floats = this._slice(this._floats, dims, 0);
		}
	}

	get tensorData() {
		return this._tensorData;
	}

	get dims() {
		return this._dims;
	}

	get type() {
		return this._typeToString;
	}

	get ubytes() {
		return this._ubytes;
	}

	get floats() {
		return this._floats;
	}

	_slice(arr, dims, index) {
		if (index + 1 == dims.length) {
			var rArray = [];
			arr.forEach(item => {
				rArray.push(item);
			});
			return rArray;
		}
		var length = arr.length;
		var chunks = dims[index];
		var lengthOfchunk = length / chunks;
		var slices = [];
		for (var i = 0; i < chunks; i++) {
			slices.push(arr.slice(i * lengthOfchunk, (i + 1) * lengthOfchunk));
		}
		if (index < dims.length - 1) {
			slices = slices.map(slice => {
				return this._slice(slice, dims, index + 1);
			});
		}
		return slices;
	}
}


dlc.Model = class {
	constructor(metadata, network, networkParam, identifier) {
		this._graph = new dlc.Graph(metadata, network, networkParam, identifier);
		this._metadata = metadata;
	}

	get format() {
		var format = 'DLC v';
		format = format + this._graph.version;
		return format;
	}

	get operators() {
		return this._graph.operator;
	}

	get graphs() {
		return [this._graph];
	}

	get graph() {
		return this._graph;
	}

	get description() {
		return 'Deep Learning Container created by one of the snpe-framework-to-dlc conversion tools';
	}

	get producer() {
		return this._metadata.producer;
	}


	get metadata() {
		return this._metadata.meta;
	}

}

dlc.Graph = class {
	constructor(metadata, network, networkParam, identifier){
		this._layers = network.layers;
		this._nodes = [];
		this._layers.forEach((layer) => {
			this._nodes.push(new dlc.Node(layer));
		});
		this._inputs = [];
		this._outputs = [];
		this._operators = {};
		this._nodes.forEach(node => {
			this._operators[node.operator] = (this._operators[node.operator] || 0) + 1; 
		});
		this._version = network.version;
		this._name = identifier;
		this._metadata = metadata;
	}

	get metadata() {
		return this._metadata;
	}

	get name() {
		return this._name;
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

	addNodeInput(name, tensor) {
		this._nodes.forEach(node => {
			if (node.name == name) {
				var initializer = new dlc.Tensor(tensor);
				var connection = new dlc.Connection(tensor.name, initializer, initializer.type);
				node.inputs.push(new dlc.Argument(tensor.name, [connection]));
			}
		});
	}

	get operators() {
		return this._operators;
	}

	get version() {
		return this._version;
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
		this._args = layer.args;
		this._attributes = [];
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

	get attributes() {
		if (this._attributes.length > 0) {
			return this._attributes;
		}
		this._args.forEach(arg => {
			this._attributes.push(new dlc.Attribute(arg));
		});
		return this._attributes;
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

dlc.Attribute = class {
	constructor(arg) {
		this._name = arg.name;
		this._type = dnn_serial3.DataTypeName[arg.type];
		this._value = this._getValue(arg);
	}

	get name() {
		return this._name;
	}

	get type() {
		return this._type;
	}

	get value() {
		return this._value;
	}

	_getValue(arg) {
		switch(arg.type) {
			case 0: return 'Unspecified';
			case 1: return arg.boolean;
			case 2: return arg.int;
			case 3: return arg.uint;
			case 4: return arg.float;
			case 5: return arg.string;
			case 6: return arg.ubytes;
			case 7: this._type = 'shape[]';
				return arg.ints;
			case 8: this._type = 'shape[]';
				return arg.uints;
			case 9: this._type = 'shape[]';
				return arg.floats;
			case 10: return arg.strings;
			case 11: 
				this._type = 'shape[]';
				return this._getValue(arg.args[0]);
		}
	}
};

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
		return this._type;
	}

}

dlc.Tensor = class {
	constructor(tensor) {
		this._id = tensor.name;
		this._name = null;
		this._data = tensor.data;
		if (tensor.data.type == 'float') {
			this._value = tensor.data.floats;
		} else {
			this._value = tensor.data.ubytes;
		}
		this._type = new dlc.TensorType(tensor.data.type, tensor.dims);
	}

	get id() {
		return this._id;
	}

	get kind() {
		return 'Identity Constant';
	}

	get value() {
		return this._value;
	}

	get type() {
		return this._type;
	}

	toString() {
		var context = {

		};
		return dlc.Tensor._stringify(this._value, '', '    ');
	}

	static _stringify(value, indentation, indent) {
        if (Array.isArray(value)) {
            var result = [];
            result.push(indentation + '[');
            var items = value.map((item) => dlc.Tensor._stringify(item, indentation + indent, indent));
            if (items.length > 0) {
                result.push(items.join(',\n'));
            }
            result.push(indentation + ']');
            return result.join('\n');
        }
        if (typeof value == 'string') {
            return indentation + value;
        }
        if (value == Infinity) {
            return indentation + 'Infinity';
        }
        if (value == -Infinity) {
            return indentation + '-Infinity';
        }
        if (isNaN(value)) {
            return indentation + 'NaN';
        }
        return indentation + value.toString();
    }

}

dlc.TensorType = class {
	constructor(type, dim) {
		this._type = type;
		this._dims = new dlc.TensorShape(dim);
	}

	get dataType() {
		return this._type;
	}

	get shape() {
		return this._dims;
	}

	toString() {
		return this.dataType + this.shape.toString();
	}
}

dlc.TensorShape = class {
	constructor(dim) {
		this._dims = dim;
	}

	get dimensions() {
		return this._dims;
	}

	toString() {
		return (this._dims && this._dims.length) ? ('[' + this._dims.join(',') + ']') : '';
		
	}
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