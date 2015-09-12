import json

from taurus.external.qt import Qt
from taurus import Manager
from taurus.qt.qtgui.panel import TaurusWidget
from taurus.core.taurusbasetypes import TaurusSerializationMode

from synopticwidget import SynopticWidget
from taurusregistry import Registry


class TaurusSynopticWidget(SynopticWidget):

    """A SynopticWidget that connects to Tango in order to
    get updates for models (attributes)."""

    def __init__(self, parent=None, **kwargs):
        super(self.__class__, self).__init__(parent)
        Manager().setSerializationMode(TaurusSerializationMode.Concurrent)
        self._url = None

    def setModel(self, url, section=None):
        self.set_url(url)
        self.registry = Registry(self._attribute_listener)
        self.registry.start()
        #self._setup_ui(url, section)

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

    def _attribute_listener(self, event):
        # TODO: seems like multiline strings may need more escaping, else
        # evaljs complains about "SyntaxError: Expected token ')'"
        self.js.evaluate("synoptic.handleEvent(%r)" % json.dumps(event))

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
