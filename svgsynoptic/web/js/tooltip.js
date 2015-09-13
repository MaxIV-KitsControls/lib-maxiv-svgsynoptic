Tooltip = (function () {

    var element;

    
    function Tooltip(container, svg) {
        element = d3.select(container)
            .append("div")
            .classed("tooltip", true);
        
        element
            .append("div")
            .classed("model", true)
        
        element
            .append("div")
            .classed("info", true);

        svg.selectAll(".section, .model")
            .on("mouseover", updateTooltip.bind(null, true))
            .on("mousemove", positionTooltip)
            .on("mouseout", updateTooltip.bind(null, false));
    }

    Tooltip.prototype.setHTML = function (html) {
        console.log("***********")
        element.select(".info")
            .html(html);
    }

    var callback;
    Tooltip.prototype.addCallback = function (cb) {
        callback = cb;
    }
    
    var currentModel;
    
    function _updateTooltip(show, data) {
        if (show) {
            if (data.model != currentModel) {
                console.log(show + " " + data.model);
                element.style("display", null);
            }
            currentModel = data.model;
            element.select(".model").text(data.model);
            callback(data.model)
        } else {
            console.log("leave");
            currentModel = null;
            element.select(".model").text("")
            element.select(".info").text("")
            element.style("display", "none");
            callback([]);
        }   
    }

    var updateTooltip = _.debounce(_updateTooltip, 100, {leading: false});
    
    function positionTooltip(data) {
        if (d3.event) {
            var x = d3.event.clientX, y = d3.event.clientY;
            console.log(x + " " + y);
            if (x > window.innerWidth/2) {
                element.style("left", null);
                element.style("right", window.innerWidth - x);
            } else {
                element.style("left", x);
                element.style("right", null);
            }
            element.style("top", y);
        }
    }
                                
    return Tooltip;
    
})();
