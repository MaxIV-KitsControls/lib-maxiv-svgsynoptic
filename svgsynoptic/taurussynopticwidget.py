import json

from PyQt4 import QtCore
import PyTango
from synopticwidget import SynopticWidget
from taurus import Manager, Attribute
from taurus.core.taurusbasetypes import TaurusSerializationMode
from taurus.external.qt import Qt
from taurus.qt.qtgui.panel import TaurusWidget, TaurusDevicePanel
from taurusregistry import Registry


class TooltipUpdater(QtCore.QThread):

    finished = QtCore.pyqtSignal(str, str)

    def __init__(self, model):
        QtCore.QThread.__init__(self)
        self.model = model

    def run(self):
        # TODO: This needs to be redone; maybe use string.template?
        try:
            attribute = Attribute(str(self.model) + "/State")
            if attribute:
                value = attribute.read()
                html = json.dumps('Value:&nbsp;' +
                                  '<span class="value">%s</span>'
                                  % value.value)
            self.finished.emit(self.model, html)
        except PyTango.DevFailed as e:
            print e


class TaurusSynopticWidget(SynopticWidget, TaurusWidget):

    """A SynopticWidget that connects to Tango in order to
    get updates for models (attributes)."""

    def __init__(self, parent=None, **kwargs):
        super(self.__class__, self).__init__(parent=parent)
        Manager().setSerializationMode(TaurusSerializationMode.Concurrent)
        self._panels = {}

    def setModel(self, image, section=None):
        print "setModel", image
        self.set_url(image)
        self.registry = Registry(self._attribute_listener)
        self.registry.start()

        self._tooltip_data = {}
        self.tooltip_registry = Registry(self._tooltip_updater)
        self.tooltip_registry.start()

    def getModel(self):
        return self._url

    def closeEvent(self, event):
        "Clean things up when the difget is"
        self.registry.clear()
        self.registry.stop()
        self.registry.wait()
        self.registry = None

    def handle_subscriptions(self, models):
        print "handle_subscriptions", models
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
                self.js.evaluate("synoptic.setState('model', %r, %r)" %
                                 (device.name(), str(value)))

    def on_click(self, kind, name):
        """The default behavior is to mark a clicked device and to zoom to a
        clicked section.  Override this function if you need something
        else.
        """
        print "on_click", kind, name
        if kind == "model":
            self.select(kind, [name])
            self.emit(Qt.SIGNAL("graphicItemSelected(QString)"), name)
        elif kind == "section":
            self.zoom_to(kind, name)

    def on_rightclick(self, kind, name):
        """We'll try to open a generic Taurus panel for a clicked
        device. Override this for more custom behavior!"""
        if kind == "model" and self.registry.device_validator.isValid(name):
            if name in self._panels:
                widget = self._panels[name]
                if not widget.isVisible():
                    widget.show()
                widget.activateWindow()
                widget.raise_()
            else:
                widget = TaurusDevicePanel()
                widget.setModel(name)
                widget.closeEvent = lambda _: self._cleanup_panel(widget)
                self._panels[name] = widget
                widget.show()

    def _cleanup_panel(self, w):
        """In the long run it seems like a good idea to try and clean up
        closed panels. In particular, the Taurus polling thread can
        become pretty bogged down."""
        if self.registry:
            with self.registry.lock:
                print "cleaning up panel for", w.getModel(), "..."
                self._panels.pop(str(w.getModel()), None)
                w.setModel(None)
                print "done!"

    # def __on_tooltip(self, model):
    #     if hasattr(self, "_updater") and self._updater.isRunning():
    #         self._updater.stop()
    #     self._updater = TooltipUpdater(model)
    #     self._updater.finished.connect(self._on_tooltip)
    #     self._updater.start()

    # def _on_tooltip(self, model, html):
    #     self.js.evaluate('synoptic.setTooltipHTML("%s", %s)' % (model, html))

    def on_tooltip(self, models):
        print "on_tooltip", models
        if models:
            all_models = []
            for model in models:
                if self.registry.device_validator.isValid(model):
                    all_models.append(model + "/State")
                    all_models.append(model + "/Status")
                else:
                    all_models.append(model)
            self.tooltip_registry.subscribe(all_models)
            self._tooltip_data = dict((str(model), {}) for model in models)
        else:
            self.tooltip_registry.subscribe()
            self._tooltip_data.clear()

        print "Tooltip listeners:", self._tooltip_data

    def _tooltip_updater(self, evt_src, evt_type, evt_value):
        if evt_type in (PyTango.EventType.CHANGE_EVENT,
                        PyTango.EventType.PERIODIC_EVENT):
            value = evt_value.value
            model = evt_src.getNormalName()
            device, attr = model.rsplit("/", 1)
            if attr in ("State", "Status"):
                self._tooltip_data[device][attr] = value
                dev = evt_src.getParentObj()
                info = dev.getHWObj().info()
                print info
                self._tooltip_data[device]["Class"] = info.dev_class
                # self._tooltip_data.setdefault("Class", device.)
                self._update_device_tooltip(device)
            else:
                self._tooltip_data[model] = evt_value

            # html = json.dumps('Value:&nbsp;' +
            #                   '<span class="value">%s</span>'
            #                   % value)
            # self.js.evaluate('synoptic.setTooltipHTML("%s", %s)' %
            #                  (model, html))

    def _update_device_tooltip(self, device):
        # TODO: this is pretty flaky...
        data = {"Class": "...", "State": "...", "Status": "..."}
        data.update(self._tooltip_data[device])
        html = json.dumps(
            ('<div>Class:&nbsp;<span>{Class}</span></div>' +
             '<div>State:&nbsp;<span class="{State}">{State}</span></div>' +
             '<div>Status:&nbsp;<span>{Status}</span></div>').format(**data))
        self.js.evaluate('synoptic.setTooltipHTML("%s", %s)' %
                         (device, html))

    def closeEvent(self, event):
        # Get rid of all opened panels, otherwise the application will
        # not exit cleanly.
        super(self.__class__, self).closeEvent(event)
        for model, panel in self._panels.items():
            print "closing panel for", model
            panel.close()


if __name__ == '__main__':
    import sys
    print sys.argv[1]
    qapp = Qt.QApplication([])
    sw = TaurusSynopticWidget()
    sw.setModel(sys.argv[1])
    sw.show()
    qapp.exec_()
