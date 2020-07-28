/* This backend is for use with the PyQt widget wrapper. 
It really just passes calls through to the Qt application. */

var QtBackend;

new QWebChannel(qt.webChannelTransport,
                function(channel) { QtBackend = channel.objects.QtBackend; });

function Backend () {
    var _oldModels = "";
    this.subscribe = function (models) {
        // the JS/python bridge does not support sending 
        // lists, so we need to build a string here.
        var newModels = models.join("\n");
        if (newModels != _oldModels) {
            QtBackend.subscribe(newModels);
            _oldModels = newModels;
        }
    }
    this.leftClick = function (kind, model) {
        // console.log("left_click", kind, model);
        QtBackend.left_click(kind, model);
    }
    this.rightClick = function (kind, model) {
        // console.log("right_click", kind, model);
        QtBackend.right_click(kind, model);
    }
}

