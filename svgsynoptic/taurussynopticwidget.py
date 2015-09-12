import json

import PyTango
from synopticwidget import SynopticWidget
from taurus import Manager
from taurus.core.taurusbasetypes import TaurusSerializationMode
from taurus.external.qt import Qt
from taurus.qt.qtgui.panel import TaurusWidget
from taurusregistry import Registry


class TaurusSynopticWidget(SynopticWidget, TaurusWidget):

    """A SynopticWidget that connects to Tango in order to
    get updates for models (attributes)."""

    def __init__(self, parent=None, **kwargs):
        super(self.__class__, self).__init__(parent=parent)
        Manager().setSerializationMode(TaurusSerializationMode.Concurrent)

    def setModel(self, image, section=None):
        print "setModel", image
        self.set_url(image)
        self.registry = Registry(self._attribute_listener)
        self.registry.start()

    def getModel(self):
        return self._url

    def closeEvent(self, event):
        "Clean things up when the difget is"
        self.registry.clear()
        self.registry.stop()
        self.registry.wait()
        self.registry = None

    def handle_subscriptions(self, models):
        if self.registry:
            self.registry.subscribe(models)

    def __attribute_listener(self, event):
        # TODO: seems like multiline strings may need more escaping, else
        # evaljs complains about "SyntaxError: Expected token ')'"
        self.js.evaluate("synoptic.handleEvent(%r)" % json.dumps(event))

    def _attribute_listener(self, evt_src, evt_type, evt_value):
        if evt_type in (PyTango.EventType.CHANGE_EVENT,
                        PyTango.EventType.PERIODIC_EVENT):
            value = evt_value.value
            device = evt_src.getParentObj()
            if isinstance(value, PyTango._PyTango.DevState):
                self.js.evaluate("synoptic.setState('device', %r, %r)" %
                                 (device.name(), str(value)))

    def on_click(self, kind, name):
        """The default behavior is to mark a clicked device and to zoom to a
        clicked section.  Override this function if you need something
        else.
        """
        print "on_click", kind, name
        if kind == "device":
            self.select_devices([name])
            self.emit(Qt.SIGNAL("graphicItemSelected(QString)"), name)
        elif kind == "section":
            self.zoom_to(kind, name)


if __name__ == '__main__':
    import sys
    print sys.argv[1]
    qapp = Qt.QApplication([])
    sw = TaurusSynopticWidget()
    sw.setModel(sys.argv[1])
    sw.show()
    qapp.exec_()
