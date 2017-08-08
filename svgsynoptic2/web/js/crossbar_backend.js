var Backend = (function () {

    function Backend() {

        var connection = new autobahn.Connection({url: "ws://localhost:8080/ws",
                                                  realm: "realm1"});

        var backend = this;
        
        connection.onopen = function (session, details) {
            console.log("open", session, details);
            backend.session = session;
            backend.details = details;
        }

        console.log(connection);
        connection.open();
        
        function handleEvent(model, eventArray, event, details) {
            console.log("event", model, eventArray[0]);
            synoptic.setClasses("model", model, {state: true});
            synoptic.setData("model", model, {value: ['ON',
                                                      'OFF',
                                                      'CLOSE',
                                                      'OPEN',
                                                      'INSERT',
                                                      'EXTRACT',
                                                      'MOVING',
                                                      'STANDBY',
                                                      'FAULT',
                                                      'INIT',
                                                      'RUNNING',
                                                      'ALARM',
                                                      'DISABLE',
                                                      'UNKNOWN'][eventArray[0].value]});
        }

        var subscribedModels = [];
        var subscriptions = {};
        
        this.subscribe = function (models) {
            console.log("subscrube", models);
            models.forEach(function (model) {
                model = model.toLowerCase();
                var fullModel = model;
                if (model.split("/").length == 3) {
                    fullModel = model + "/state";
                }
                if (subscribedModels.indexOf(fullModel) == -1) {
                    subscribedModels.push(fullModel);
                    console.log("subsecrit", model);                    
                    backend.session
                           .subscribe(fullModel, handleEvent.bind(null, model))
                           .then(function (sub) {
                               console.log("subscribed to", sub);
                               subscriptions[fullModel] = sub
                           });
                } else {
                    // nothing!
                }
            });
            var removed = [];
            subscribedModels.forEach(function (model) {
                var index = models.indexOf(model);
                if (index == -1) {
                    removed.push(model);
                    var sub = subscriptions[model];
                    console.log("unsub", sub);
                    if (sub) {
                        backend.session.unsubscribe(sub);
                    } else {
                        console.log(model, "not in", subscribedModels);
                    }
                    delete subscriptions[model];
                }
            });
            removed.forEach(function (model) {
                subscribedModels.splice(subscribedModels.indexOf(model), 1)
            });
        }

    }
    
    return new Backend();
    
})();
