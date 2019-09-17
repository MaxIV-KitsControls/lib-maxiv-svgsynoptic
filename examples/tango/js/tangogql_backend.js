function HttpBackend() {
    const url = "wss://webjive.maxiv.lu.se/cry/socket";
    const socket = new WebSocket(url, "graphql-ws");

    const query = `
        subscription Attributes($fullNames: [String]!) {
          attributes(fullNames: $fullNames) {
            attribute
            value
            device
            quality
          }
        }
    `;

    const variables = {}
    variables.fullNames = []
    
    this.subscribe = function (models) {
        console.log("Models", models)
        models.forEach(function (model) {
            model = model.toLowerCase();
            var fullModel = model;
            if (model.split("/").length == 3) {
                fullModel = model + "/state";
            }
            variables.fullNames.push(fullModel);
        });
        console.log("Subscribing: ", variables.fullNames);
        const startMessage = JSON.stringify({
            type: "start",
            payload: {
                query,
                variables
            }
        });
        socket.send(startMessage);
    }

    this.rightClick = function (kind, model) {
        console.log(kind, model);
        win = window.open("https://webjive.maxiv.lu.se/cry/devices/" + model);
        win.close();
    } 

    socket.addEventListener("message", msg => {
        const attribute = JSON.parse(msg.data).payload.data.attributes.attribute;
        const value = JSON.parse(msg.data).payload.data.attributes.value;
        const device = JSON.parse(msg.data).payload.data.attributes.device;
        const quality = JSON.parse(msg.data).payload.data.attributes.quality;
        // console.log("Recieved", attribute, value, device);
        if (attribute === "state") {
                synoptic.setClasses("model", device , {state: true});
                synoptic.setData("model", device , {value: value, quality: quality});
            } 
        else if (value === true || value === false){
            synoptic.setClasses("model", device + '/' + attribute, {boolean: true});
            synoptic.setData("model", device + '/' + attribute, {value: value, quality: quality});
        }
        else {
            synoptic.setData("model", device + '/' + attribute, {value: parseFloat(value).toFixed(2), quality: quality});
            synoptic.setText("model", device + '/' + attribute, parseFloat(value).toFixed(2));
        }
    });

}

var Backend = HttpBackend;


// const url = "wss://webjive.maxiv.lu.se/kitslab/socket";
// const socket = new WebSocket(url, "graphql-ws");

// const query = `
//     subscription Attributes($fullNames: [String]!) {
//         attributes(fullNames: $fullNames) {
//         attribute
//         value
//         device
//         quality
//         }
//     }
// `;

// socket.addEventListener("message", msg => {
//     const attribute = JSON.parse(msg.data);
//     // const value = JSON.parse(msg.data).payload.data.attributes.value;
//     console.log("attribute", attribute);
// });

// const variables = { fullNames: ["jonas/tg_test/1/double_scalar", "jonas/tg_test/1/state"] };

// const startMessage = JSON.stringify({
//     type: "start",
//     payload: {
//     query,
//     variables
//     }
// });

// socket.send(startMessage);