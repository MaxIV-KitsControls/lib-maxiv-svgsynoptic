"""
An experimental plugin for attaching notes to the synoptic.
Not finished!
"""

import csv
import json
import webbrowser

import requests


elog_url = "http://localhost:8081/femtomaxsynoptic"
"""
ELOG Notes:

All posts after 2016-01-12 14:31:39:
  search http://localhost:8081/femtomaxsynoptic/?mode=CSV1&reverse=0&npp=20&ma=1&da=12&ya=2016&ha=14&na=31&ca=39

"""


def open_note(widget, args):
    mid = args
    webbrowser.open(elog_url + "/" + mid)


def new_note(widget, args):
    code, position = args.split(",")
    webbrowser.open(elog_url + "/?cmd=new&pPosition=%s&pIdentifier=%s" % (code, position))


def load_notes(widget, args):
    return get_notes(widget)


def get_notes(widget):
    result = requests.get(elog_url + "?mode=CSV1")
    lines = list(csv.reader(result.text.encode("utf-8").splitlines()))
    notes = []
    headers = lines[0]
    for line in lines[1:]:
        note = dict(item for item in zip(headers, line))
        position = note.get("Position")
        if position:
            x, y = [float(part) if "." in part else int(part)
                    for part in position.split(";")]
            note["position"] = {"x": x, "y": y}
        notes.append(note)
    widget.js.evaluate("synoptic.setNotes('%s')" % json.dumps(notes))
