Tooltip = (function () {


    // A simple tooltip (info box that pops up under the mouse)
    function Tooltip(element, nodeId, data) {

        this.id = nodeId;
        this.data = data;

        var tooltip = d3.select(element)
                .append("div")
                .classed("tooltip", true);

        this.update = function (data) {
            console.log(JSON.stringify(data));
            tooltip.html('<div class="model">' +
                         (this.data.model || this.data.section) + "</div>");
        };

        this.setHTML = function (model, html) {
            if (model == this.data.model) {
                tooltip.html('<div class="model">' + this.data.model + "</div>" +
                             html);
            }
        }
        
        this.move = function () {
            // Crude attempt to make the tooltip fit on the screen... improve!
            if (d3.event.clientX > window.innerWidth/2) {
                tooltip
                    .style("left", d3.event.clientX - 10 - tooltip.node().clientWidth)
                    .style("top", d3.event.clientY + 10);
            } else {
                tooltip
                    .style("left", d3.event.clientX + 10)
                    .style("top", d3.event.clientY + 10);
            }
        };

        this.close = function () {
            tooltip.remove();
        };

    };

    return Tooltip;

})();
