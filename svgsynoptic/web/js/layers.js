/*
 This creates the layer selector togglers that allow individual layers
 to be turned on/off. 
 */

LayerTogglers = (function () {

    function _LayerTogglers (container, svg, config) {

        config = config || {};
        
        var togglable = svg.selectAll(".layer.togglable");
                            

        var node = d3.select(container)
                .append("div")
                .classed("layer-toggles", true);

        togglable.each(function () {
            var name = this.getAttribute("id");
            console.log(name);
            node.append("div")
                .text(name)
                .classed("layer-toggle", true)
                .classed(name, true)
                .on("click", function () {toggleLayer(name, this);});
        });

        var callbacks = [];

        this.addCallback = function (cb) {
            callbacks.push(cb);
        };

        // Toggle the layer with the given name off if it's on and vice versa
        function toggleLayer (layername) {
            var button = node.select("div.layer-toggle." + layername),
                shown = !button.node().classList.contains("hidden");
            button.classed("hidden", shown);
            svg.select("#" + layername)
                .classed("hidden", shown);
            callbacks.forEach(function (cb) {cb(layername, shown);});
        };

        if (config.hidden)
            config.hidden.forEach(function (layername) {
                if (config.hidden.indexOf(layername) != -1)
                    toggleLayer(layername);
            });
        
    }

    return _LayerTogglers;

})();
