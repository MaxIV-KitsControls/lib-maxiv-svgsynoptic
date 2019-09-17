Notes = (function () {

    function make_identifier() {
        // Looks like the crypto module is not available in Qt4 :( But
        // since we're not relying on these uuids for security or
        // anything, just note identification, it should be fine.
        if (crypto.getRandomVariables) 
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = crypto.getRandomValues(new Uint8Array(1))[0]%16|0, v = c == 'x' ? r : (r&0x3|0x8);
                return v.toString(16);
            });
        else
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
                return v.toString(16);
            });
    }

    
    function _Notes (container, view, notes, config) {

        var shown = false;
                
        notes = notes || [];
        config = config || {};

        var noteContainer = document.createElement("div");
        noteContainer.style.position = "absolute";
        noteContainer.style.top = "0";
        noteContainer.style.width ="0";
        noteContainer.style.height = "0";
        noteContainer.style.display = "none";
        noteContainer.style.userSelect = "none";        
        container.appendChild(noteContainer);

        // hide the notes when the view starts changing...
        function hideNotes () {
            noteContainer.style.display = "none";
        }
        function showNotes () {
            if (shown)
                noteContainer.style.display = null;
        }

        // view.addCallback(_.debounce(hideNotes, 500,
        //                             {leading: true, trailing: false}));

        // when the view stops changing, update note positions and show them
        function updateNotes (vbox) {
            notes.forEach(function (note) {
                var contBBox = container.getBoundingClientRect(),
                    scale = contBBox.width / vbox.width, x, y;
                if (note.Pinned) {
                    x = note.position.x * contBBox.width - 10;
                    y = note.position.y * contBBox.height - 10;
                } else {
                    x = (note.position.x - vbox.x) * scale;
                    y = (note.position.y - vbox.y) * scale;
                }
                note.element.style.left = x + "px";                
                note.element.style.top = y + "px";
            });
            if (shown)
                showNotes();
            updateNotesButton();            
        }
        view.addCallback(updateNotes);

        function updateNotesButton() {
            var visibleNotes = notes.filter(function (note) {
                return view.isInView(note.position)});
            button.innerHTML = "Notes (" + visibleNotes.length + ")";
        }
        
        var button = document.createElement("div");
        button.style.position = "absolute";
        button.style.bottom = "10px";
        button.style.right = "10px";
        button.style.padding = "3px";
        button.style.border = "1px solid black";
        button.style.zIndex = "1002";
        button.style.backgroundColor = "yellow";
        button.style.userSelect = "none";
        button.style.opacity = "0.5";
        button.innerHTML = "Notes (" + notes.length + ")";
        button.title = "Click to toggle notes. Drag from here to create new notes."
        // button.classList.add("active");
        button.addEventListener("click", function () {
            button.classList.toggle("active");
            if (button.classList.contains("active")) {
                shown = true;
                showNotes();
                button.style.opacity = null;
            } else {
                shown = false;                
                hideNotes();
                button.style.opacity = "0.5";
            }
        });
        button.draggable = "true";
        button.addEventListener("dragstart", function () {
            if (shown) {
                var note = {
                    mid: 0,
                    title: "New note",
                    position: {x: 0, y: 0}
                };
                drawNote(note);
                _drag_init(note);
                return false;
            }
        });                

        function drawNote (note) {
            var noteEl = document.createElement("div");
            noteEl.style.position = "absolute";
            noteEl.style.display = "block";
            // noteEl.style.left = note.position.x + "px";
            // noteEl.style.top = note.position.y + "px";
            noteEl.style.width = "25px";
            noteEl.style.height = "25px";
            noteEl.style.border = "1px solid black";
            if (note.Pinned)
                noteEl.style.boxShadow = "3px 3px 1px rgba(0,0,0,0.3)"
            else
                noteEl.style.outline = "2px solid rgba(0,0,0,0.25)";
            noteEl.style.zIndex = "1001";
            // noteEl.style.opacity = "0.75"; 
            noteEl.style.userSelect = "none";
            noteEl.style.fontSize = "8pt";
            noteEl.style.padding = "2pt";
            noteEl.title = note.Subject;

            noteEl.style.textAlign = "center";
            noteEl.innerHTML = note["Message ID"];

            switch(note.Type) {
            case "Routine":
                noteEl.style.backgroundColor = "lightblue";
                noteEl.innerHTML += "<br>:)"
                break;
            case "Software Installation":
                noteEl.style.backgroundColor = "yellow";
                break;
            case "Problem Fixed":
                noteEl.style.backgroundColor = "orange";
                noteEl.innerHTML += "<br>!"
                break;
            case "Configuration":
                noteEl.style.backgroundColor = "red"; 
                noteEl.style.color = "white";
                noteEl.style.fontWeight = "bold";
                noteEl.innerHTML += "<br>!!!"                
                break;
            default:
                noteEl.style.backgroundColor = "lightgrey";
                noteEl.style.borderStyle = "dashed"
            }
            
            noteContainer.appendChild(noteEl);

            note.element = noteEl;
            
            noteEl.draggable = "true";
            noteEl.addEventListener("dragstart", function () {
                _drag_init(note);
                return false;
            });                

            noteEl.addEventListener("click", function () {
                console.log(Backend.run_plugin_command("notes", "open_note", "" + note["Message ID"]));
                return false;
            });                                
        }
        
        container.appendChild(button);
        
        notes.forEach(function (note, i) {
            
            if (note.model) {
                // notes attached to an item
            } else if (note.position) {
                // notes freely positioned
                drawNote(note);
            }
            
        });    

        var selected = null, dragged_note, // Object of the element to be moved
            x_pos = 0, y_pos = 0, // Stores x & y coordinates of the mouse pointer
            x_elem = 0, y_elem = 0; // Stores top, left values (edge) of the element
        
        // Will be called when user starts dragging a note
        function _drag_init(note) {
            dragged_note = note;
            var rect = dragged_note.element.getBoundingClientRect();
            x_pos = rect.left;
            y_pos = rect.top;
            x_elem = 10; 
            y_elem = 10;
            document.addEventListener("mousemove", _move_elem);
            document.addEventListener("mouseup", _finish);
        }

        // Finish move by updating the note position
        function _finish() {
            var vbox = view.getViewBox(),
                contBBox = container.getBoundingClientRect(),
                scale = contBBox.width / vbox.width, x, y;
            if (dragged_note.Pinned) {
                x = x_pos / contBBox.width;
                y = y_pos / contBBox.height;
            } else {
                x = (x_pos - x_elem) / scale + vbox.x,
                y = (y_pos - y_elem) / scale + vbox.y;
            }
            dragged_note.position.x = x;
            dragged_note.position.y = y;
            x_pos = 0;
            y_pos = 0;
            document.removeEventListener("mousemove", _move_elem);
            document.removeEventListener("mouseup", _finish);
            if (!_.contains(notes, dragged_note)) {
                var identifier = make_identifier();
                notes.push(dragged_note);
                console.log("load_notes", Backend.run_plugin_command(
                    "notes", "new_note", Math.round(dragged_note.position.x) + ";" + Math.round(dragged_note.position.y) + "," + identifier));
            }
            updateNotesButton();
            dragged_note = null;
        }

        // Called while dragging a note
        function _move_elem(e) {
            x_pos = document.all ? window.event.clientX : e.pageX;
            y_pos = document.all ? window.event.clientY : e.pageY;
            if (dragged_note.element !== null) {
                dragged_note.element.style.left = (x_pos - x_elem) + 'px';
                dragged_note.element.style.top = (y_pos - y_elem) + 'px';
            }
        }

        this.setData = function (data) {
            console.log("setData", data)
            notes = data;
            notes.forEach(function (note) {
                drawNote(note);
            });
            updateNotes(view.getViewBox())
        }

        // A hack to initially get the notes...
        window.setTimeout(function () {
            Backend.run_plugin_command("notes", "load_notes", "");
        }, 1000);

    }

    return _Notes
    
})();
