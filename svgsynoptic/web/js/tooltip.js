Tooltip = (function () {

    // Template for the tooltip
    var tooltipContent = Handlebars.compile(
        "<table>" +
            "{{#if device}}" +
               '<tr><td class="label">Device:</td><td class="value">{{device}} {{subscribed}}</td></tr>' +
            // '<tr><td class="label">State:</td><td class="value">{{html}}</td></tr>' +
               '<tr><td class="label">Type:</td><td class="value">{{devtype}}</td></yt>' +
            "{{else}}" +
                "{{#if attribute}}" +
                   '<tr><td class="label">Attribute:</td><td class="value">{{attribute}}</td></tr>' +
                   // '<tr><td class="label">Value:</td><td class="value">{{value}}</td></tr>' +
                "{{/if}}" +
            "{{/if}}" +
            "{{#if section}}" +
                '<tr><td class="label">Section:</td><td class="value">{{section}}</td></tr>' +
            "{{/if}}" +
        "</table>"
    );


    function Tooltip(element, nodeId) {

        this.id = nodeId;

        console.log("Tooltip: " + nodeId);

        var tooltip = d3.select(element)
                .append("div")
                .classed("tooltip", true);
            //.html(function () {return tooltipContent(data);})
            // .style("display", "inline");

        this.update = function (data) {
            console.log(JSON.stringify(data));
            tooltip.html(function () {return tooltipContent(data);});
        };

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
